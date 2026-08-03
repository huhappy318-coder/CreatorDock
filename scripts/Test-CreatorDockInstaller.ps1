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

$installedProduct = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CreatorDock' -ErrorAction SilentlyContinue
if ($installedProduct -and $installedProduct.InstallLocation) {
    throw "Installer self-test requires a clean Windows user because NSIS product registration is user-scoped. CreatorDock is already registered at $($installedProduct.InstallLocation). Run this test in CI or Windows Sandbox."
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("CreatorDock-Installer-Test-{0}" -f ([guid]::NewGuid().ToString('N')))
$testRoot = [IO.Path]::GetFullPath($testRoot)
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$createdShortcut = $null
$uninstaller = $null
$baseShortcut = Join-Path $desktop 'CreatorDock.lnk'
$createdConflictSentinel = $false
if (-not (Test-Path -LiteralPath $baseShortcut -PathType Leaf)) {
    $sentinel = $shell.CreateShortcut($baseShortcut)
    $sentinel.TargetPath = Join-Path $env:WINDIR 'System32\notepad.exe'
    $sentinel.Description = 'CreatorDock installer conflict sentinel'
    $sentinel.Save()
    $createdConflictSentinel = $true
}
$initialShortcuts = @(Get-ChildItem -LiteralPath $desktop -Filter 'CreatorDock*.lnk' -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
$initialTargets = @{}
foreach ($initialShortcut in $initialShortcuts) {
    $initialTargets[$initialShortcut] = $shell.CreateShortcut($initialShortcut).TargetPath
}

New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    $process = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$testRoot") -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Installer exited with code $($process.ExitCode)."
    }

    $targetExecutable = @(Get-ChildItem -LiteralPath $testRoot -Filter '*.exe' -File | Where-Object Name -ne 'uninstall.exe' | Select-Object -First 1).FullName
    if ([string]::IsNullOrWhiteSpace($targetExecutable)) {
        throw "No installed CreatorDock executable was found under $testRoot."
    }
    foreach ($initialShortcut in $initialShortcuts) {
        if (-not (Test-Path -LiteralPath $initialShortcut -PathType Leaf)) {
            throw "Installer moved or removed a pre-existing Desktop shortcut during installation: $initialShortcut"
        }
        $preserved = $shell.CreateShortcut($initialShortcut)
        if ([IO.Path]::GetFullPath($preserved.TargetPath) -ne [IO.Path]::GetFullPath($initialTargets[$initialShortcut])) {
            throw "Installer changed the target of a pre-existing Desktop shortcut: $initialShortcut"
        }
    }
    $shortcuts = @(Get-ChildItem -LiteralPath $desktop -Filter 'CreatorDock*.lnk' -File -ErrorAction SilentlyContinue)
    $targetedShortcuts = @()
    foreach ($shortcut in $shortcuts) {
        $opened = $shell.CreateShortcut($shortcut.FullName)
        if ([IO.Path]::GetFullPath($opened.TargetPath) -eq $targetExecutable) {
            $targetedShortcuts += $shortcut.FullName
        }
    }
    if ($targetedShortcuts.Count -ne 1) {
        $targeted = $targetedShortcuts -join ', '
        throw "Expected exactly one CreatorDock Desktop shortcut targeting $targetExecutable; found $($targetedShortcuts.Count): $targeted"
    }
    $createdShortcut = $targetedShortcuts[0]
    if ($null -eq $createdShortcut) {
        throw "No CreatorDock Desktop shortcut targets $targetExecutable."
    }

    $uninstaller = Join-Path $testRoot 'uninstall.exe'
    if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
        throw "Uninstaller was not found: $uninstaller"
    }
    $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
    if ($uninstallProcess.ExitCode -ne 0) {
        throw "Uninstaller exited with code $($uninstallProcess.ExitCode)."
    }
    if (Test-Path -LiteralPath $createdShortcut) {
        $restored = $shell.CreateShortcut($createdShortcut)
        if ([IO.Path]::GetFullPath($restored.TargetPath) -eq $targetExecutable) {
            throw "Installer-owned Desktop shortcut was not removed: $createdShortcut"
        }
    }
    $remainingShortcuts = @(Get-ChildItem -LiteralPath $desktop -Filter 'CreatorDock*.lnk' -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
    $unexpectedShortcuts = @($remainingShortcuts | Where-Object { $initialShortcuts -notcontains $_ })
    if ($unexpectedShortcuts.Count -ne 0) {
        throw "Installer left new Desktop shortcuts behind: $($unexpectedShortcuts -join ', ')"
    }
    foreach ($initialShortcut in $initialShortcuts) {
        if (-not (Test-Path -LiteralPath $initialShortcut -PathType Leaf)) {
            throw "Installer removed a pre-existing Desktop shortcut: $initialShortcut"
        }
        $preserved = $shell.CreateShortcut($initialShortcut)
        if ([IO.Path]::GetFullPath($preserved.TargetPath) -ne [IO.Path]::GetFullPath($initialTargets[$initialShortcut])) {
            throw "Installer changed a pre-existing Desktop shortcut target after uninstall: $initialShortcut"
        }
    }

    [pscustomobject]@{
        Passed = $true
        Installer = $installer
        InstallRoot = $testRoot
        ShortcutRemoved = $true
        PreExistingShortcutsPreserved = $true
    }
}
finally {
    if ($uninstaller -and (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
        Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -ErrorAction SilentlyContinue
    }
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
