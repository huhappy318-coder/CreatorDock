[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$installer = [IO.Path]::GetFullPath($InstallerPath)
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
    throw "Installer was not found: $installer"
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$hooksPath = Join-Path $repositoryRoot 'src-tauri\windows\hooks.nsh'
if (-not (Test-Path -LiteralPath $hooksPath -PathType Leaf)) {
    throw "NSIS hooks were not found: $hooksPath"
}
$hooksSource = Get-Content -LiteralPath $hooksPath -Raw
$preInstall = [regex]::Match(
    $hooksSource,
    '(?ms)^!macro\s+NSIS_HOOK_PREINSTALL\s*(.*?)^!macroend'
)
if (-not $preInstall.Success -or $preInstall.Groups[1].Value -notmatch '(?m)^\s*StrCpy\s+\$NoShortcutMode\s+1\s*$') {
    throw 'NSIS pre-install hook must set $NoShortcutMode to 1 before Tauri creates Start Menu or silent/passive Desktop shortcuts.'
}
$postInstallFinal = [regex]::Match(
    $hooksSource,
    '(?ms)^creator_dock_postinstall_done:\s*(.*?)^\s*!macroend'
)
if (-not $postInstallFinal.Success -or $postInstallFinal.Groups[1].Value -notmatch '(?m)^\s*StrCpy\s+\$NoShortcutMode\s+1\s*$') {
    throw 'NSIS post-install hook must set $NoShortcutMode to 1 at its normal final path so the generated finish-page callback cannot overwrite a preserved shortcut.'
}
if ($hooksSource -match '(?m)^\s*Rename\s+"\$DESKTOP\\CreatorDock\.lnk"') {
    throw 'NSIS hooks must not move an existing CreatorDock.lnk: a foreign Desktop shortcut must remain in place throughout installation.'
}
if ($hooksSource -match 'CreatorDock-existing\.lnk|\$PLUGINSDIR') {
    throw 'NSIS hooks must not stage an existing Desktop shortcut in the installer plugin directory.'
}
if ($hooksSource -notmatch '(?ms)^creator_dock_create_primary:\s*.*?^\s*CreateShortCut\s+"\$DESKTOP\\CreatorDock\.lnk"') {
    throw 'NSIS post-install hook must create the no-conflict CreatorDock Desktop shortcut itself.'
}
if ($hooksSource -notmatch '(?ms)^creator_dock_create_suffix:\s*.*?^\s*CreateShortCut\s+"\$2"') {
    throw 'NSIS post-install hook must create a numbered app-owned shortcut directly when a foreign CreatorDock.lnk exists.'
}
if ($hooksSource -notmatch '(?ms)^creator_dock_start_menu_create_primary:\s*.*?^\s*CreateShortCut\s+"\$3"') {
    throw 'NSIS post-install hook must restore the CreatorDock Start Menu shortcut after suppressing Tauri defaults.'
}

$installedProduct = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CreatorDock' -ErrorAction SilentlyContinue
if ($installedProduct -and $installedProduct.InstallLocation) {
    throw "Installer self-test requires a clean Windows user because NSIS product registration is user-scoped. CreatorDock is already registered at $($installedProduct.InstallLocation). Run this test in CI or Windows Sandbox."
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("CreatorDock-Installer-Test-{0}" -f ([guid]::NewGuid().ToString('N')))
$testRoot = [IO.Path]::GetFullPath($testRoot)
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$baseShortcut = Join-Path $desktop 'CreatorDock.lnk'
$createdConflictSentinel = $false

function Get-CreatorDockShortcuts {
    @(Get-ChildItem -LiteralPath $desktop -Filter 'CreatorDock*.lnk' -File -ErrorAction SilentlyContinue)
}

function Get-ShortcutTarget([string]$ShortcutPath) {
    $opened = $shell.CreateShortcut($ShortcutPath)
    if ([string]::IsNullOrWhiteSpace($opened.TargetPath)) {
        return ''
    }
    [IO.Path]::GetFullPath($opened.TargetPath)
}

function Get-ShortcutSnapshot {
    $snapshot = @{}
    foreach ($shortcut in @(Get-CreatorDockShortcuts)) {
        $snapshot[$shortcut.FullName] = Get-ShortcutTarget $shortcut.FullName
    }
    $snapshot
}

function Assert-ShortcutSnapshotPreserved([hashtable]$Snapshot, [string]$Stage) {
    foreach ($shortcutPath in $Snapshot.Keys) {
        if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
            throw "$Stage moved or removed a pre-existing Desktop shortcut: $shortcutPath"
        }
        $currentTarget = Get-ShortcutTarget $shortcutPath
        if ($currentTarget -ine $Snapshot[$shortcutPath]) {
            throw "$Stage changed the target of a pre-existing Desktop shortcut: $shortcutPath"
        }
    }
}

function Invoke-InstallerScenario {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$InstallRoot,
        [Parameter(Mandatory)][hashtable]$InitialSnapshot,
        [Parameter(Mandatory)][string]$ExpectedShortcutPath,
        [Parameter(Mandatory)][string[]]$InstallerArguments
    )

    New-Item -ItemType Directory -Path $InstallRoot | Out-Null
    $createdShortcut = $null
    $uninstaller = $null
    try {
        $process = Start-Process -FilePath $installer -ArgumentList @($InstallerArguments + "/D=$InstallRoot") -Wait -PassThru
        if ($process.ExitCode -ne 0) {
            throw "$Name installer exited with code $($process.ExitCode)."
        }

        $targetExecutable = @(Get-ChildItem -LiteralPath $InstallRoot -Filter '*.exe' -File | Where-Object Name -ne 'uninstall.exe' | Select-Object -First 1).FullName
        if ([string]::IsNullOrWhiteSpace($targetExecutable)) {
            throw "$Name did not install a CreatorDock executable under $InstallRoot."
        }
        $targetExecutable = [IO.Path]::GetFullPath($targetExecutable)

        Assert-ShortcutSnapshotPreserved -Snapshot $InitialSnapshot -Stage "$Name installation"
        $targetedShortcuts = @(
            foreach ($shortcut in @(Get-CreatorDockShortcuts)) {
                if ((Get-ShortcutTarget $shortcut.FullName) -ieq $targetExecutable) {
                    $shortcut.FullName
                }
            }
        )
        if ($targetedShortcuts.Count -ne 1) {
            throw "$Name expected exactly one CreatorDock Desktop shortcut targeting $targetExecutable; found $($targetedShortcuts.Count): $($targetedShortcuts -join ', ')"
        }
        $createdShortcut = $targetedShortcuts[0]
        if ([IO.Path]::GetFullPath($createdShortcut) -ine [IO.Path]::GetFullPath($ExpectedShortcutPath)) {
            throw "$Name created the app shortcut at $createdShortcut instead of $ExpectedShortcutPath."
        }

        $registeredShortcut = (Get-ItemProperty -LiteralPath 'HKCU:\Software\CreatorDock' -Name DesktopShortcut -ErrorAction Stop).DesktopShortcut
        if ([IO.Path]::GetFullPath($registeredShortcut) -ine [IO.Path]::GetFullPath($createdShortcut)) {
            throw "$Name registered DesktopShortcut as $registeredShortcut instead of $createdShortcut."
        }

        $uninstaller = Join-Path $InstallRoot 'uninstall.exe'
        if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
            throw "$Name uninstaller was not found: $uninstaller"
        }
        $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
        if ($uninstallProcess.ExitCode -ne 0) {
            throw "$Name uninstaller exited with code $($uninstallProcess.ExitCode)."
        }
        $uninstaller = $null

        if (Test-Path -LiteralPath $createdShortcut -PathType Leaf) {
            if ((Get-ShortcutTarget $createdShortcut) -ieq $targetExecutable) {
                throw "$Name installer-owned Desktop shortcut was not removed: $createdShortcut"
            }
        }
        Assert-ShortcutSnapshotPreserved -Snapshot $InitialSnapshot -Stage "$Name uninstall"
        $remainingShortcuts = @(Get-CreatorDockShortcuts | Select-Object -ExpandProperty FullName)
        $unexpectedShortcuts = @($remainingShortcuts | Where-Object { -not $InitialSnapshot.ContainsKey($_) })
        if ($unexpectedShortcuts.Count -ne 0) {
            throw "$Name left new Desktop shortcuts behind: $($unexpectedShortcuts -join ', ')"
        }

        [pscustomobject]@{
            Name = $Name
            Shortcut = $createdShortcut
            ShortcutRemoved = $true
            PreExistingShortcutsPreserved = $true
        }
    }
    finally {
        if ($uninstaller -and (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
            Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -ErrorAction SilentlyContinue
        }
    }
}

if (Test-Path -LiteralPath $baseShortcut -PathType Leaf) {
    throw "Installer self-test requires CreatorDock.lnk to be absent initially so the no-conflict /NS path can be verified without changing an existing Desktop shortcut: $baseShortcut"
}

New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    $noConflictSnapshot = Get-ShortcutSnapshot
    $noConflict = Invoke-InstallerScenario `
        -Name 'No-conflict /S scenario' `
        -InstallRoot (Join-Path $testRoot 'no-conflict') `
        -InitialSnapshot $noConflictSnapshot `
        -ExpectedShortcutPath $baseShortcut `
        -InstallerArguments @('/S')

    $sentinel = $shell.CreateShortcut($baseShortcut)
    $sentinel.TargetPath = Join-Path $env:WINDIR 'System32\notepad.exe'
    $sentinel.Description = 'CreatorDock installer conflict sentinel'
    $sentinel.Save()
    $createdConflictSentinel = $true

    $conflictSnapshot = Get-ShortcutSnapshot
    $expectedSuffixIndex = 2
    do {
        $expectedConflictShortcut = Join-Path $desktop ("CreatorDock ({0}).lnk" -f $expectedSuffixIndex)
        $expectedSuffixIndex++
    } while (Test-Path -LiteralPath $expectedConflictShortcut -PathType Leaf)

    $conflict = Invoke-InstallerScenario `
        -Name 'Foreign-shortcut /S scenario' `
        -InstallRoot (Join-Path $testRoot 'conflict') `
        -InitialSnapshot $conflictSnapshot `
        -ExpectedShortcutPath $expectedConflictShortcut `
        -InstallerArguments @('/S')

    $expectedSuffixIndex = 2
    do {
        $expectedPassiveConflictShortcut = Join-Path $desktop ("CreatorDock ({0}).lnk" -f $expectedSuffixIndex)
        $expectedSuffixIndex++
    } while (Test-Path -LiteralPath $expectedPassiveConflictShortcut -PathType Leaf)

    $passiveConflict = Invoke-InstallerScenario `
        -Name 'Foreign-shortcut /P scenario' `
        -InstallRoot (Join-Path $testRoot 'conflict-passive') `
        -InitialSnapshot $conflictSnapshot `
        -ExpectedShortcutPath $expectedPassiveConflictShortcut `
        -InstallerArguments @('/P')

    [pscustomobject]@{
        Passed = $true
        Installer = $installer
        StaticNoShortcutModeGuard = $true
        NoConflictShortcut = $noConflict.Shortcut
        SilentConflictShortcut = $conflict.Shortcut
        PassiveConflictShortcut = $passiveConflict.Shortcut
        ShortcutRemoved = $true
        PreExistingShortcutsPreserved = $true
    }
}
finally {
    if ($createdConflictSentinel -and (Test-Path -LiteralPath $baseShortcut -PathType Leaf)) {
        $sentinel = $shell.CreateShortcut($baseShortcut)
        if ($sentinel.Description -eq 'CreatorDock installer conflict sentinel') {
            Remove-Item -LiteralPath $baseShortcut -Force -ErrorAction SilentlyContinue
        }
    }
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
