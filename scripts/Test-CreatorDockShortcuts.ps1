$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$helperPath = Join-Path $PSScriptRoot 'New-CreatorDockShortcuts.ps1'
if (-not (Test-Path -LiteralPath $helperPath -PathType Leaf)) {
    throw "Shortcut helper is missing: $helperPath"
}

. $helperPath

$script:AssertionCount = 0

function Assert-Equal {
    param(
        [Parameter(Mandatory)]$Actual,
        [Parameter(Mandatory)]$Expected,
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

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("CreatorDock-Helper-Test-{0}" -f [guid]::NewGuid().ToString('N'))
$desktop = [Environment]::GetFolderPath('Desktop')
if ($desktop -and [IO.Path]::GetFullPath($testRoot).StartsWith([IO.Path]::GetFullPath($desktop), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Test root must never be inside Desktop.'
}

[void](New-Item -ItemType Directory -Path $testRoot)

try {
    $pretendDesktop = Join-Path $testRoot 'Pretend Desktop'
    [void](New-Item -ItemType Directory -Path $pretendDesktop)
    $blockedId = [guid]'00000000-0000-0000-0000-000000000001'
    $blockedCandidate = Join-Path $pretendDesktop 'CreatorDock-SelfTest-00000000000000000000000000000001'
    $previousTemp = $env:TEMP
    $previousTmp = $env:TMP
    try {
        $env:TEMP = $pretendDesktop
        $env:TMP = $pretendDesktop
        Assert-Throws {
            Invoke-CreatorDockShortcutSelfTest `
                -DesktopDirectory $pretendDesktop `
                -SelfTestId $blockedId
        } 'Desktop' 'A Desktop-backed temporary root must be refused.'
        Assert-Equal (Test-Path -LiteralPath $blockedCandidate) $false 'Desktop refusal must happen before creating the candidate directory.'

        $preservedId = [guid]'00000000-0000-0000-0000-000000000002'
        $preservedCandidate = Join-Path $pretendDesktop 'CreatorDock-SelfTest-00000000000000000000000000000002'
        [void](New-Item -ItemType Directory -Path $preservedCandidate)
        Assert-Throws {
            Invoke-CreatorDockShortcutSelfTest `
                -DesktopDirectory $pretendDesktop `
                -SelfTestId $preservedId
        } 'Desktop' 'Desktop refusal must also protect an existing candidate.'
        Assert-Equal (Test-Path -LiteralPath $preservedCandidate) $true 'Desktop refusal must not delete an existing candidate directory.'
    }
    finally {
        $env:TEMP = $previousTemp
        $env:TMP = $previousTmp
    }

    $validPath = Join-Path $testRoot 'valid.json'
    @'
{
  "schemaVersion": 1,
  "shortcuts": [
    {
      "displayName": "System destination",
      "destinationUrl": "https://example.com/system",
      "browserTarget": "default",
      "createShortcut": true
    },
    {
      "displayName": "Chrome destination",
      "destinationUrl": "https://example.com/chrome",
      "browserTarget": "chrome",
      "profileDirectoryName": "Profile 2",
      "createShortcut": true
    },
    {
      "displayName": "Disabled destination",
      "destinationUrl": "https://example.com/disabled",
      "browserTarget": "edge",
      "createShortcut": false
    }
  ]
}
'@ | Set-Content -LiteralPath $validPath -Encoding UTF8

    $parsed = Read-CreatorDockShortcutExport -InputPath $validPath
    Assert-Equal $parsed.Count 3 'Valid schema should load all entries.'
    Assert-Equal $parsed[1].ProfileDirectoryName 'Profile 2' 'Profile directory should be retained.'

    $invalidCases = @(
        @{ Name = 'schema'; Json = '{"schemaVersion":2,"shortcuts":[]}'; Pattern = 'schema version' },
        @{ Name = 'scheme'; Json = '{"schemaVersion":1,"shortcuts":[{"displayName":"Bad","destinationUrl":"file:///unsafe","browserTarget":"default","createShortcut":true}]}'; Pattern = 'HTTP\(S\)' },
        @{ Name = 'credentials'; Json = '{"schemaVersion":1,"shortcuts":[{"displayName":"Bad","destinationUrl":"https://user:pass@example.com/","browserTarget":"default","createShortcut":true}]}'; Pattern = 'credentials' },
        @{ Name = 'shortcuts-shape'; Json = '{"schemaVersion":1,"shortcuts":{"displayName":"Bad","destinationUrl":"https://example.com/","browserTarget":"default","createShortcut":true}}'; Pattern = 'array' },
        @{ Name = 'target'; Json = '{"schemaVersion":1,"shortcuts":[{"displayName":"Bad","destinationUrl":"https://example.com/","browserTarget":"firefox","createShortcut":true}]}'; Pattern = 'browser target' },
        @{ Name = 'profile'; Json = '{"schemaVersion":1,"shortcuts":[{"displayName":"Bad","destinationUrl":"https://example.com/","browserTarget":"chrome","profileDirectoryName":"Profile 2 --incognito","createShortcut":true}]}'; Pattern = 'profile directory' },
        @{ Name = 'missing'; Json = '{"schemaVersion":1,"shortcuts":[{"displayName":"Bad","browserTarget":"default","createShortcut":true}]}'; Pattern = 'destinationUrl' }
    )
    foreach ($case in $invalidCases) {
        $casePath = Join-Path $testRoot ("invalid-{0}.json" -f $case.Name)
        $case.Json | Set-Content -LiteralPath $casePath -Encoding UTF8
        Assert-Throws { Read-CreatorDockShortcutExport -InputPath $casePath } $case.Pattern "Invalid $($case.Name) input should be rejected."
    }

    $profileRoot = Join-Path $testRoot 'User Data'
    [void](New-Item -ItemType Directory -Path $profileRoot)
    foreach ($name in @('Default', 'Profile 2', 'Profile abc', 'Guest Profile')) {
        [void](New-Item -ItemType Directory -Path (Join-Path $profileRoot $name))
    }
    'not a directory' | Set-Content -LiteralPath (Join-Path $profileRoot 'Profile 3') -Encoding UTF8
    $profiles = @(Get-CreatorDockProfileDirectoryNames -UserDataRoot $profileRoot)
    Assert-Equal ($profiles -join ',') 'Default,Profile 2' 'Only Default and Profile N directories may be enumerated.'

    Assert-Equal (Get-CreatorDockShortcutFileName -DisplayName 'Plan/A:*?') 'Plan_A___.lnk' 'Shortcut filenames should be sanitized.'

    $outputDirectory = Join-Path $testRoot 'output'
    $browserExecutable = (Get-Process -Id $PID).Path
    $summary = New-CreatorDockShortcuts `
        -InputPath $validPath `
        -OutputDirectory $outputDirectory `
        -BrowserPaths @{ chrome = $browserExecutable }

    Assert-Equal $summary.CreatedCount 2 'Only enabled shortcuts with an available target should be created.'
    Assert-Equal $summary.SkippedCount 0 'No enabled shortcut should be skipped in the controlled fixture.'

    $shell = New-Object -ComObject WScript.Shell
    $systemLink = $shell.CreateShortcut((Join-Path $outputDirectory 'System destination.lnk'))
    Assert-Equal ([IO.Path]::GetFileName($systemLink.TargetPath)) 'rundll32.exe' 'System shortcuts should use the safe URL handler.'
    Assert-Equal $systemLink.Arguments 'url.dll,FileProtocolHandler "https://example.com/system"' 'System shortcut should contain only the validated URL argument.'

    $chromeLink = $shell.CreateShortcut((Join-Path $outputDirectory 'Chrome destination.lnk'))
    Assert-Equal $chromeLink.TargetPath $browserExecutable 'Chrome shortcut should use the selected executable.'
    Assert-Equal $chromeLink.Arguments '--new-window --profile-directory="Profile 2" "https://example.com/chrome"' 'Browser shortcut should bind the profile, URL, and separate-window flag.'

    $collision = New-CreatorDockShortcuts `
        -InputPath $validPath `
        -OutputDirectory $outputDirectory `
        -BrowserPaths @{ chrome = $browserExecutable }
    Assert-Equal $collision.CreatedCount 0 'Existing shortcuts should not be overwritten without Force.'
    Assert-Equal $collision.SkippedCount 2 'Existing shortcuts should be reported as skipped.'

    $forced = New-CreatorDockShortcuts `
        -InputPath $validPath `
        -OutputDirectory $outputDirectory `
        -BrowserPaths @{ chrome = $browserExecutable } `
        -Force
    Assert-Equal $forced.CreatedCount 2 'Force should explicitly allow overwrite.'

    $detected = Find-CreatorDockBrowsers
    foreach ($key in $detected.Keys) {
        if ($key -notin @('chrome', 'edge')) {
            throw "Browser detection returned an unsupported key: $key"
        }
    }

    [pscustomobject]@{
        Passed = $true
        Assertions = $script:AssertionCount
        TestRoot = $testRoot
        DetectedBrowserPaths = $detected
    } | ConvertTo-Json -Depth 5
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
