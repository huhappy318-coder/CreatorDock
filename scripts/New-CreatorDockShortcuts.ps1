[CmdletBinding()]
param(
    [string]$InputPath,
    [string]$OutputDirectory,
    [switch]$Force,
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-CreatorDockRequiredProperty {
    param(
        [Parameter(Mandatory)]$Object,
        [Parameter(Mandatory)][string]$Name
    )

    return $Object.PSObject.Properties.Name -contains $Name
}

function Read-CreatorDockShortcutExport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$InputPath
    )

    if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
        throw "Shortcut export file was not found: $InputPath"
    }

    try {
        $document = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "Shortcut export is not valid JSON: $($_.Exception.Message)"
    }

    if ($null -eq $document -or $document -is [array]) {
        throw 'Shortcut export root must be an object.'
    }
    if (-not (Test-CreatorDockRequiredProperty $document 'schemaVersion')) {
        throw 'Shortcut export is missing required field schemaVersion.'
    }
    if ($document.schemaVersion -isnot [int] -or $document.schemaVersion -ne 1) {
        throw "Unsupported shortcut export schema version '$($document.schemaVersion)'. Expected version 1."
    }
    if (-not (Test-CreatorDockRequiredProperty $document 'shortcuts') -or $null -eq $document.shortcuts) {
        throw 'Shortcut export is missing required field shortcuts.'
    }
    if ($document.shortcuts -isnot [array]) {
        throw 'Shortcut export field shortcuts must be an array.'
    }

    $shortcuts = @($document.shortcuts)
    $validated = @()
    for ($index = 0; $index -lt $shortcuts.Count; $index++) {
        $shortcut = $shortcuts[$index]
        if ($null -eq $shortcut -or $shortcut -is [string] -or $shortcut -is [array]) {
            throw "Shortcut at index $index must be an object."
        }

        foreach ($required in @('displayName', 'destinationUrl', 'browserTarget', 'createShortcut')) {
            if (-not (Test-CreatorDockRequiredProperty $shortcut $required)) {
                throw "Shortcut at index $index is missing required field $required."
            }
        }
        if ($shortcut.displayName -isnot [string] -or [string]::IsNullOrWhiteSpace($shortcut.displayName)) {
            throw "Shortcut at index $index field displayName must be a non-empty string."
        }
        if ($shortcut.destinationUrl -isnot [string] -or [string]::IsNullOrWhiteSpace($shortcut.destinationUrl)) {
            throw "Shortcut at index $index field destinationUrl must be a non-empty HTTP(S) URL."
        }

        $uri = $null
        if (-not [Uri]::TryCreate($shortcut.destinationUrl, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @('http', 'https')) {
            throw "Shortcut at index $index destinationUrl must use HTTP(S)."
        }
        if (-not [string]::IsNullOrEmpty($uri.UserInfo)) {
            throw "Shortcut at index $index destinationUrl must not contain credentials."
        }

        if ($shortcut.browserTarget -isnot [string] -or $shortcut.browserTarget -notin @('default', 'chrome', 'edge')) {
            throw "Shortcut at index $index browser target must be default, chrome, or edge."
        }
        if ($shortcut.createShortcut -isnot [bool]) {
            throw "Shortcut at index $index field createShortcut must be boolean."
        }

        $profileDirectoryName = $null
        if (Test-CreatorDockRequiredProperty $shortcut 'profileDirectoryName') {
            if (
                $shortcut.profileDirectoryName -isnot [string] -or
                $shortcut.profileDirectoryName -notmatch '^(Default|Profile \d+)$'
            ) {
                throw "Shortcut at index $index profile directory must be Default or Profile N."
            }
            if ($shortcut.browserTarget -eq 'default') {
                throw "Shortcut at index $index profile directory requires a Chrome or Edge browser target."
            }
            $profileDirectoryName = $shortcut.profileDirectoryName
        }

        $validated += [pscustomobject]@{
            DisplayName = $shortcut.displayName
            DestinationUrl = $uri.AbsoluteUri
            BrowserTarget = $shortcut.browserTarget
            ProfileDirectoryName = $profileDirectoryName
            CreateShortcut = $shortcut.createShortcut
        }
    }

    return $validated
}

function Find-CreatorDockBrowsers {
    [CmdletBinding()]
    param()

    $definitions = [ordered]@{
        chrome = @{
            RelativePath = 'Google\Chrome\Application\chrome.exe'
            ExecutableName = 'chrome.exe'
        }
        edge = @{
            RelativePath = 'Microsoft\Edge\Application\msedge.exe'
            ExecutableName = 'msedge.exe'
        }
    }
    $result = [ordered]@{}

    foreach ($browser in $definitions.Keys) {
        $definition = $definitions[$browser]
        $candidates = @()
        foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
            if (-not [string]::IsNullOrWhiteSpace($root)) {
                $candidates += Join-Path $root $definition.RelativePath
            }
        }

        $registryPaths = @(
            "Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\App Paths\$($definition.ExecutableName)",
            "Registry::HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\App Paths\$($definition.ExecutableName)",
            "Registry::HKEY_LOCAL_MACHINE\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\$($definition.ExecutableName)"
        )
        foreach ($registryPath in $registryPaths) {
            try {
                $registryKey = Get-Item -LiteralPath $registryPath -ErrorAction Stop
                $registeredPath = [string]$registryKey.GetValue('')
                if (-not [string]::IsNullOrWhiteSpace($registeredPath)) {
                    $candidates += $registeredPath
                }
            }
            catch {
                # A missing App Paths entry only means this detection source is unavailable.
            }
        }

        $existing = $candidates |
            Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
            Select-Object -First 1
        if ($existing) {
            $result[$browser] = [IO.Path]::GetFullPath($existing)
        }
    }

    return $result
}

function Get-CreatorDockProfileDirectoryNames {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$UserDataRoot
    )

    if (-not (Test-Path -LiteralPath $UserDataRoot -PathType Container)) {
        return @()
    }

    return @(
        Get-ChildItem -LiteralPath $UserDataRoot -Directory -Force |
            Where-Object { $_.Name -eq 'Default' -or $_.Name -match '^Profile \d+$' } |
            Select-Object -ExpandProperty Name |
            Sort-Object @{ Expression = { if ($_ -eq 'Default') { -1 } else { [int]($_ -replace '^Profile ', '') } } }
    )
}

function Get-CreatorDockDetectedProfiles {
    [CmdletBinding()]
    param()

    $profiles = [ordered]@{}
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        return $profiles
    }

    $roots = [ordered]@{
        chrome = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
        edge = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'
    }
    foreach ($browser in $roots.Keys) {
        $profiles[$browser] = @(Get-CreatorDockProfileDirectoryNames -UserDataRoot $roots[$browser])
    }
    return $profiles
}

function Get-CreatorDockShortcutFileName {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$DisplayName
    )

    $invalid = [IO.Path]::GetInvalidFileNameChars()
    $characters = foreach ($character in $DisplayName.ToCharArray()) {
        if ($invalid -contains $character) { '_' } else { $character }
    }
    $name = (-join $characters).Trim().TrimEnd('.', ' ')
    if ([string]::IsNullOrWhiteSpace($name)) {
        $name = 'CreatorDock shortcut'
    }
    if ($name -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)') {
        $name = "_$name"
    }
    if ($name.Length -gt 120) {
        $name = $name.Substring(0, 120).TrimEnd('.', ' ')
    }
    return "$name.lnk"
}

function New-CreatorDockShortcuts {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [Parameter(Mandatory)][string]$OutputDirectory,
        [hashtable]$BrowserPaths,
        [switch]$Force
    )

    $entries = @(Read-CreatorDockShortcutExport -InputPath $InputPath)
    if ($null -eq $BrowserPaths) {
        $BrowserPaths = Find-CreatorDockBrowsers
    }

    $resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
    if (-not (Test-Path -LiteralPath $resolvedOutput -PathType Container)) {
        [void](New-Item -ItemType Directory -Path $resolvedOutput)
    }

    $created = @()
    $skipped = @()
    $shell = New-Object -ComObject WScript.Shell
    $systemDirectory = [Environment]::GetFolderPath('System')
    $systemTarget = Join-Path $systemDirectory 'rundll32.exe'

    foreach ($entry in $entries) {
        if (-not $entry.CreateShortcut) {
            continue
        }

        if ($entry.BrowserTarget -ne 'default' -and -not $BrowserPaths.ContainsKey($entry.BrowserTarget)) {
            $skipped += [pscustomobject]@{
                DisplayName = $entry.DisplayName
                BrowserTarget = $entry.BrowserTarget
                Reason = 'BrowserNotFound'
            }
            continue
        }

        $shortcutPath = Join-Path $resolvedOutput (Get-CreatorDockShortcutFileName -DisplayName $entry.DisplayName)
        if ((Test-Path -LiteralPath $shortcutPath) -and -not $Force) {
            $skipped += [pscustomobject]@{
                DisplayName = $entry.DisplayName
                BrowserTarget = $entry.BrowserTarget
                ShortcutPath = $shortcutPath
                Reason = 'AlreadyExists'
            }
            continue
        }

        if ($entry.BrowserTarget -eq 'default') {
            $targetPath = $systemTarget
            $arguments = 'url.dll,FileProtocolHandler "{0}"' -f $entry.DestinationUrl
        }
        else {
            $targetPath = [IO.Path]::GetFullPath([string]$BrowserPaths[$entry.BrowserTarget])
            if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
                throw "Configured $($entry.BrowserTarget) executable was not found: $targetPath"
            }
            $arguments = if ($entry.ProfileDirectoryName) {
                '--new-window --profile-directory="{0}" "{1}"' -f $entry.ProfileDirectoryName, $entry.DestinationUrl
            }
            else {
                '--new-window "{0}"' -f $entry.DestinationUrl
            }
        }

        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $targetPath
        $shortcut.Arguments = $arguments
        $shortcut.WorkingDirectory = $resolvedOutput
        $shortcut.Description = "CreatorDock: $($entry.DisplayName)"
        $shortcut.Save()

        $created += [pscustomobject]@{
            DisplayName = $entry.DisplayName
            DestinationUrl = $entry.DestinationUrl
            BrowserTarget = $entry.BrowserTarget
            ProfileDirectoryName = $entry.ProfileDirectoryName
            ShortcutPath = $shortcutPath
            TargetPath = $targetPath
            Arguments = $arguments
        }
    }

    return [pscustomobject]@{
        SchemaVersion = 1
        OutputDirectory = $resolvedOutput
        CreatedCount = $created.Count
        SkippedCount = $skipped.Count
        Created = $created
        Skipped = $skipped
        DetectedBrowserPaths = $BrowserPaths
    }
}

function Invoke-CreatorDockShortcutSelfTest {
    [CmdletBinding()]
    param(
        [string]$TemporaryParent = [IO.Path]::GetTempPath(),
        [string]$DesktopDirectory = [Environment]::GetFolderPath('Desktop'),
        [guid]$SelfTestId = [guid]::NewGuid()
    )

    $temporaryParent = [IO.Path]::GetFullPath($TemporaryParent).TrimEnd('\')
    $temporaryRoot = Join-Path $temporaryParent ("CreatorDock-SelfTest-{0}" -f $SelfTestId.ToString('N'))
    $temporaryRoot = [IO.Path]::GetFullPath($temporaryRoot)
    $leaf = Split-Path -Leaf $temporaryRoot
    if ((Split-Path -Parent $temporaryRoot) -ne $temporaryParent -or $leaf -notmatch '^CreatorDock-SelfTest-[0-9a-f]{32}$') {
        throw "Refusing unsafe self-test directory: $temporaryRoot"
    }
    if (-not [string]::IsNullOrWhiteSpace($DesktopDirectory)) {
        $desktopRoot = [IO.Path]::GetFullPath($DesktopDirectory).TrimEnd('\')
        $desktopPrefix = "$desktopRoot$([IO.Path]::DirectorySeparatorChar)"
        if (
            $temporaryRoot.Equals($desktopRoot, [StringComparison]::OrdinalIgnoreCase) -or
            $temporaryRoot.StartsWith($desktopPrefix, [StringComparison]::OrdinalIgnoreCase)
        ) {
            throw "Refusing Desktop-backed self-test directory: $temporaryRoot"
        }
    }

    $browserPaths = Find-CreatorDockBrowsers
    $profiles = Get-CreatorDockDetectedProfiles
    $validation = @()
    $summary = $null
    [void](New-Item -ItemType Directory -Path $temporaryRoot)

    try {
        $shortcutDefinitions = @(
            [ordered]@{
                displayName = 'CreatorDock system self-test'
                destinationUrl = 'https://example.com/creatordock-self-test/system'
                browserTarget = 'default'
                createShortcut = $true
            }
        )
        foreach ($browser in @('chrome', 'edge')) {
            if (-not $browserPaths.Contains($browser)) {
                continue
            }
            $definition = [ordered]@{
                displayName = "CreatorDock $browser self-test"
                destinationUrl = "https://example.com/creatordock-self-test/$browser"
                browserTarget = $browser
                createShortcut = $true
            }
            $availableProfiles = @($profiles[$browser])
            if ($availableProfiles.Count -gt 0) {
                $definition.profileDirectoryName = $availableProfiles[0]
            }
            $shortcutDefinitions += $definition
        }

        $exportPath = Join-Path $temporaryRoot 'self-test-export.json'
        [ordered]@{
            schemaVersion = 1
            shortcuts = $shortcutDefinitions
        } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $exportPath -Encoding UTF8

        $outputPath = Join-Path $temporaryRoot 'shortcuts'
        $summary = New-CreatorDockShortcuts `
            -InputPath $exportPath `
            -OutputDirectory $outputPath `
            -BrowserPaths $browserPaths

        $shell = New-Object -ComObject WScript.Shell
        foreach ($created in $summary.Created) {
            $reopened = $shell.CreateShortcut($created.ShortcutPath)
            $targetMatches = [IO.Path]::GetFullPath($reopened.TargetPath) -eq [IO.Path]::GetFullPath($created.TargetPath)
            $argumentsMatch = $reopened.Arguments -eq $created.Arguments
            $urlMatches = $reopened.Arguments.Contains($created.DestinationUrl)
            if (-not ($targetMatches -and $argumentsMatch -and $urlMatches)) {
                throw "Self-test shortcut validation failed for '$($created.DisplayName)'."
            }
            $validation += [pscustomobject]@{
                DisplayName = $created.DisplayName
                BrowserTarget = $created.BrowserTarget
                ProfileDirectoryName = $created.ProfileDirectoryName
                TargetMatches = $targetMatches
                ArgumentsMatch = $argumentsMatch
                UrlMatches = $urlMatches
            }
        }
    }
    finally {
        if (Test-Path -LiteralPath $temporaryRoot) {
            Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
        }
    }

    return [pscustomobject]@{
        Passed = $true
        TemporaryDirectory = $temporaryRoot
        TemporaryDirectoryRemoved = -not (Test-Path -LiteralPath $temporaryRoot)
        DetectedBrowserPaths = $browserPaths
        ProfileDirectoryNames = $profiles
        CreatedCount = $summary.CreatedCount
        ShortcutValidation = $validation
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    if ($SelfTest) {
        Invoke-CreatorDockShortcutSelfTest
    }
    else {
        if ([string]::IsNullOrWhiteSpace($InputPath)) {
            throw 'InputPath is required unless SelfTest is used.'
        }
        if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
            throw 'OutputDirectory is required unless SelfTest is used.'
        }
        New-CreatorDockShortcuts `
            -InputPath $InputPath `
            -OutputDirectory $OutputDirectory `
            -Force:$Force
    }
}
