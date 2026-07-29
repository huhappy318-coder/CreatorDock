$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$launcherPath = Join-Path $PSScriptRoot 'Start-CreatorDock.ps1'
if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
    throw "CreatorDock launcher is missing: $launcherPath"
}

$script:AssertionCount = 0

function Assert-Equal {
    param(
        [Parameter(Mandatory)][AllowNull()]$Actual,
        [Parameter(Mandatory)][AllowNull()]$Expected,
        [Parameter(Mandatory)][string]$Message
    )

    $script:AssertionCount++
    if ($Actual -ne $Expected) {
        throw "$Message Expected '$Expected', received '$Actual'."
    }
}

function Assert-Throws {
    param(
        [Parameter(Mandatory)][scriptblock]$Action,
        [Parameter(Mandatory)][string]$Pattern,
        [Parameter(Mandatory)][string]$Message
    )

    $script:AssertionCount++
    try {
        & $Action
    }
    catch {
        if ($_.Exception.Message -notmatch $Pattern) {
            throw "$Message Wrong error: $($_.Exception.Message)"
        }
        return
    }
    throw "$Message Expected an error matching '$Pattern'."
}

function Get-FreeTcpPort {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    try {
        return ([Net.IPEndPoint]$listener.LocalEndpoint).Port
    }
    finally {
        $listener.Stop()
    }
}

function Wait-HttpReady {
    param(
        [Parameter(Mandatory)][string]$Url,
        [int]$TimeoutSeconds = 10
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        try {
            return Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
        }
        catch {
            Start-Sleep -Milliseconds 100
        }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "HTTP fixture did not become ready: $Url"
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("CreatorDock-Launcher-Test-{0}" -f [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $testRoot)
$fixturePath = Join-Path $testRoot 'fixture-server.mjs'
@'
import http from 'node:http'
const port = Number(process.argv[2])
const mode = process.argv[3]
const body = mode === 'creator'
  ? '<!doctype html><html><head><title>CreatorDock</title></head><body><div id="root"></div></body></html>'
  : '<!doctype html><html><head><title>Unrelated</title></head><body>other service</body></html>'
http.createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(body)
}).listen(port, '127.0.0.1')
'@ | Set-Content -LiteralPath $fixturePath -Encoding UTF8

$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$fixtureProcesses = @()
$previewProcessId = $null

try {
    $unrelatedPort = Get-FreeTcpPort
    $unrelated = Start-Process -FilePath $nodePath -ArgumentList @($fixturePath, "$unrelatedPort", 'unrelated') -WindowStyle Hidden -PassThru
    $fixtureProcesses += $unrelated
    [void](Wait-HttpReady -Url "http://127.0.0.1:$unrelatedPort/")

    Assert-Throws {
        & $launcherPath -Port $unrelatedPort -NoBrowser -PassThru
    } 'unrelated|occupied|CreatorDock' 'The launcher must refuse an unrelated process occupying its port.'
    Assert-Equal ($null -ne (Get-Process -Id $unrelated.Id -ErrorAction SilentlyContinue)) $true 'The unrelated process must remain alive.'

    $creatorPort = Get-FreeTcpPort
    $creator = Start-Process -FilePath $nodePath -ArgumentList @($fixturePath, "$creatorPort", 'creator') -WindowStyle Hidden -PassThru
    $fixtureProcesses += $creator
    [void](Wait-HttpReady -Url "http://127.0.0.1:$creatorPort/")

    $reused = & $launcherPath -Port $creatorPort -NoBrowser -PassThru
    Assert-Equal $reused.Reused $true 'A verified CreatorDock page should be reused.'
    Assert-Equal $reused.StartedProcessId $null 'Reuse must not report a newly started process.'
    Assert-Equal ($null -ne (Get-Process -Id $creator.Id -ErrorAction SilentlyContinue)) $true 'The reused process must remain alive.'

    $previewPort = Get-FreeTcpPort
    $started = & $launcherPath -Port $previewPort -NoBrowser -PassThru
    $previewProcessId = $started.StartedProcessId
    Assert-Equal $started.Reused $false 'An empty port should start the repository preview.'
    Assert-Equal ($previewProcessId -is [int]) $true 'The launcher should report its own preview process ID.'
    $previewResponse = Wait-HttpReady -Url $started.Url
    Assert-Equal ([int]$previewResponse.StatusCode) 200 'The spawned production preview should answer HTTP 200.'
    Assert-Equal ($previewResponse.Content -match '<title>CreatorDock</title>') $true 'The spawned page should be verified as CreatorDock.'

    [pscustomobject]@{
        Passed = $true
        Assertions = $script:AssertionCount
        UnrelatedProcessSurvived = $true
        CreatorDockProcessReused = $true
        SpawnedPreviewProcessId = $previewProcessId
        SpawnedPreviewUrl = $started.Url
    } | ConvertTo-Json -Depth 4
}
finally {
    if ($null -ne $previewProcessId) {
        Stop-Process -Id $previewProcessId -Force -ErrorAction SilentlyContinue
    }
    foreach ($process in $fixtureProcesses) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
