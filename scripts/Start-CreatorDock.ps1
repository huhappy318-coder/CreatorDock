[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$Port = 4173,
    [switch]$NoBrowser,
    [switch]$PassThru
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-CreatorDockHttpEvidence {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Url,
        [int]$TimeoutSeconds = 2
    )

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSeconds
        $body = [string]$response.Content
        return [pscustomobject]@{
            Reachable = $true
            StatusCode = [int]$response.StatusCode
            IsCreatorDock = (
                [int]$response.StatusCode -eq 200 -and
                $body.Contains('<title>CreatorDock</title>') -and
                $body -match 'id=["'']root["'']'
            )
        }
    }
    catch {
        return [pscustomobject]@{
            Reachable = $false
            StatusCode = $null
            IsCreatorDock = $false
        }
    }
}

function Test-CreatorDockTcpPort {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$HostName,
        [Parameter(Mandatory)][int]$Port,
        [int]$TimeoutMilliseconds = 500
    )

    $client = New-Object Net.Sockets.TcpClient
    try {
        $connection = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $connection.AsyncWaitHandle.WaitOne($TimeoutMilliseconds)) {
            return $false
        }
        $client.EndConnect($connection)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Wait-CreatorDockHttpReady {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][Diagnostics.Process]$Process,
        [int]$TimeoutSeconds = 20
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $Process.Refresh()
        if ($Process.HasExited) {
            throw "CreatorDock preview exited before readiness with code $($Process.ExitCode)."
        }
        $evidence = Get-CreatorDockHttpEvidence -Url $Url
        if ($evidence.IsCreatorDock) {
            return $evidence
        }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "CreatorDock preview did not become ready at $Url within $TimeoutSeconds seconds."
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$url = "http://127.0.0.1:$Port/"
$existingEvidence = Get-CreatorDockHttpEvidence -Url $url
if ($existingEvidence.IsCreatorDock) {
    if (-not $NoBrowser) {
        [void](Start-Process -FilePath $url)
    }
    $result = [pscustomobject]@{
        Url = $url
        HttpStatus = $existingEvidence.StatusCode
        Reused = $true
        StartedProcessId = $null
        BrowserOpened = -not $NoBrowser
    }
    if ($PassThru) { return $result }
    $result
    return
}

if (Test-CreatorDockTcpPort -HostName '127.0.0.1' -Port $Port) {
    throw "Refusing to replace or kill the unrelated process occupying 127.0.0.1:$Port because it did not return a verified CreatorDock page."
}

$packagePath = Join-Path $repositoryRoot 'package.json'
$vitePath = Join-Path $repositoryRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
    throw "CreatorDock package.json was not found: $packagePath"
}
if (-not (Test-Path -LiteralPath $vitePath -PathType Leaf)) {
    throw "CreatorDock local dependencies are missing. Run 'npm ci' in $repositoryRoot first."
}

$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
Push-Location $repositoryRoot
try {
    & $npmCommand run build | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "CreatorDock production build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

if (Test-CreatorDockTcpPort -HostName '127.0.0.1' -Port $Port) {
    $postBuildEvidence = Get-CreatorDockHttpEvidence -Url $url
    if ($postBuildEvidence.IsCreatorDock) {
        if (-not $NoBrowser) {
            [void](Start-Process -FilePath $url)
        }
        $result = [pscustomobject]@{
            Url = $url
            HttpStatus = $postBuildEvidence.StatusCode
            Reused = $true
            StartedProcessId = $null
            BrowserOpened = -not $NoBrowser
        }
        if ($PassThru) { return $result }
        $result
        return
    }
    throw "Refusing to replace or kill the process that occupied 127.0.0.1:$Port while CreatorDock was building."
}

$nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
$previewProcess = Start-Process `
    -FilePath $nodeCommand `
    -ArgumentList @($vitePath, 'preview', '--host', '127.0.0.1', '--port', "$Port", '--strictPort') `
    -WorkingDirectory $repositoryRoot `
    -WindowStyle Hidden `
    -PassThru

try {
    $ready = Wait-CreatorDockHttpReady -Url $url -Process $previewProcess
}
catch {
    if (-not $previewProcess.HasExited) {
        Stop-Process -Id $previewProcess.Id -Force
    }
    throw
}

if (-not $NoBrowser) {
    [void](Start-Process -FilePath $url)
}
$result = [pscustomobject]@{
    Url = $url
    HttpStatus = $ready.StatusCode
    Reused = $false
    StartedProcessId = $previewProcess.Id
    BrowserOpened = -not $NoBrowser
}
if ($PassThru) { return $result }
$result
