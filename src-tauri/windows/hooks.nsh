!include LogicLib.nsh

!macro CreatorDock_IsShortcutTargetIgnoreCase shortcut target label_prefix
  StrCpy $8 0
  !insertmacro ComHlpr_CreateInProcInstance ${CLSID_ShellLink} ${IID_IShellLink} r5 ""
  ${If} $5 P<> 0
    ${IUnknown::QueryInterface} $5 '("${IID_IPersistFile}", .r6)'
    ${If} $6 P<> 0
      ${IPersistFile::Load} $6 '("${shortcut}", ${STGM_READ})'
      System::Alloc MAX_PATH
      Pop $7
      ${IShellLink::GetPath} $5 '(.r7, ${MAX_PATH}, 0, ${SLGP_RAWPATH})'
      System::Call 'kernel32::CompareStringOrdinal(w r7, i -1, w "${target}", i -1, i 1) i .r9'
      StrCmp $9 2 ${label_prefix}_match ${label_prefix}_done
    ${label_prefix}_match:
      StrCpy $8 1
    ${label_prefix}_done:
      System::Free $7
      ${IUnknown::Release} $6 ""
    ${EndIf}
    ${IUnknown::Release} $5 ""
  ${EndIf}
  Push $8
!macroend

!macro NSIS_HOOK_PREINSTALL
  ; Older CreatorDock builds registered a browser PWA service worker inside
  ; WebView2. Remove only that app-owned cache before the new embedded assets
  ; are used; the Tauri Store and WebView local storage remain untouched.
  RmDir /r "$LOCALAPPDATA\com.creatordock.desktop\EBWebView\Default\Service Worker"

  ; Tauri creates Start Menu and Desktop links after this hook for /S and /P.
  ; Claim those links here so the post-install hook can create only links that
  ; belong to CreatorDock, without overwriting an unrelated same-name link.
  StrCpy $NoShortcutMode 1
!macroend

!macro NSIS_HOOK_POSTINSTALL
creator_dock_find_registered:
  ; An earlier CreatorDock install may already own a suffixed Desktop link
  ; because another application owned CreatorDock.lnk. Keep that existing
  ; app-owned link across upgrades instead of making another one.
  ReadRegStr $2 HKCU "Software\CreatorDock" "DesktopShortcut"
  ${If} $2 != ""
    IfFileExists "$2" 0 creator_dock_check_primary
    !insertmacro CreatorDock_IsShortcutTargetIgnoreCase "$2" "$INSTDIR\creator_dock.exe" creatordock_postinstall_check
    Pop $8
    ${If} $8 = 1
      Goto creator_dock_record_shortcut
    ${EndIf}
  ${EndIf}

  ; If the primary name is ours, this is a normal update. Never overwrite an
  ; unrelated CreatorDock.lnk: create a new numbered link instead.
  IfFileExists "$DESKTOP\CreatorDock.lnk" creator_dock_check_primary creator_dock_create_primary

creator_dock_check_primary:
  !insertmacro CreatorDock_IsShortcutTargetIgnoreCase "$DESKTOP\CreatorDock.lnk" "$INSTDIR\creator_dock.exe" creatordock_primary_check
  Pop $8
  ${If} $8 = 1
    StrCpy $2 "$DESKTOP\CreatorDock.lnk"
    Goto creator_dock_record_shortcut
  ${EndIf}

creator_dock_find_suffix_start:
  StrCpy $1 2
creator_dock_find_suffix:
  StrCpy $2 "$DESKTOP\CreatorDock ($1).lnk"
  IfFileExists "$2" 0 creator_dock_create_suffix
  IntOp $1 $1 + 1
  Goto creator_dock_find_suffix

creator_dock_create_suffix:
  CreateShortCut "$2" "$INSTDIR\creator_dock.exe" "" "$INSTDIR\creator_dock.exe" 0 SW_SHOWNORMAL
  !insertmacro SetLnkAppUserModelId "$2"
  Goto creator_dock_record_shortcut

creator_dock_create_primary:
  CreateShortCut "$DESKTOP\CreatorDock.lnk" "$INSTDIR\creator_dock.exe" "" "$INSTDIR\creator_dock.exe" 0 SW_SHOWNORMAL
  StrCpy $2 "$DESKTOP\CreatorDock.lnk"
  !insertmacro SetLnkAppUserModelId "$2"
creator_dock_record_shortcut:
  WriteRegStr HKCU "Software\CreatorDock" "DesktopShortcut" "$2"
  Goto creator_dock_start_menu_find_registered

creator_dock_start_menu_find_registered:
  ; Tauri's configured start-menu location is CreatorDock\CreatorDock.lnk.
  ; Keep a registered CreatorDock-owned suffix across upgrades.
  ReadRegStr $3 HKCU "Software\CreatorDock" "StartMenuShortcut"
  ${If} $3 != ""
    IfFileExists "$3" 0 creator_dock_start_menu_check_primary
    !insertmacro CreatorDock_IsShortcutTargetIgnoreCase "$3" "$INSTDIR\creator_dock.exe" creatordock_start_menu_registered_check
    Pop $8
    ${If} $8 = 1
      Goto creator_dock_start_menu_record_shortcut
    ${EndIf}
  ${EndIf}

creator_dock_start_menu_check_primary:
  StrCpy $3 "$SMPROGRAMS\CreatorDock\CreatorDock.lnk"
  IfFileExists "$3" creator_dock_start_menu_primary_exists creator_dock_start_menu_create_primary

creator_dock_start_menu_primary_exists:
  !insertmacro CreatorDock_IsShortcutTargetIgnoreCase "$3" "$INSTDIR\creator_dock.exe" creatordock_start_menu_primary_check
  Pop $8
  ${If} $8 = 1
    Goto creator_dock_start_menu_record_shortcut
  ${EndIf}

creator_dock_start_menu_find_suffix_start:
  StrCpy $1 2
creator_dock_start_menu_find_suffix:
  StrCpy $3 "$SMPROGRAMS\CreatorDock\CreatorDock ($1).lnk"
  IfFileExists "$3" 0 creator_dock_start_menu_create_suffix
  IntOp $1 $1 + 1
  Goto creator_dock_start_menu_find_suffix

creator_dock_start_menu_create_suffix:
  CreateDirectory "$SMPROGRAMS\CreatorDock"
  CreateShortCut "$3" "$INSTDIR\creator_dock.exe" "" "$INSTDIR\creator_dock.exe" 0 SW_SHOWNORMAL
  !insertmacro SetLnkAppUserModelId "$3"
  Goto creator_dock_start_menu_record_shortcut

creator_dock_start_menu_create_primary:
  CreateDirectory "$SMPROGRAMS\CreatorDock"
  CreateShortCut "$3" "$INSTDIR\creator_dock.exe" "" "$INSTDIR\creator_dock.exe" 0 SW_SHOWNORMAL
  !insertmacro SetLnkAppUserModelId "$3"
creator_dock_start_menu_record_shortcut:
  WriteRegStr HKCU "Software\CreatorDock" "StartMenuShortcut" "$3"
creator_dock_postinstall_done:
  ; The pre-install hook suppressed Tauri's default shortcut paths. Keep this
  ; set for the interactive finish-page callback as well.
  StrCpy $NoShortcutMode 1
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ReadRegStr $2 HKCU "Software\CreatorDock" "DesktopShortcut"
  ${If} $2 != ""
    IfFileExists "$2" 0 creatordock_uninstall_registry_cleanup
    !insertmacro CreatorDock_IsShortcutTargetIgnoreCase "$2" "$INSTDIR\creator_dock.exe" creatordock_uninstall_check
    Pop $8
    ${If} $8 = 1
      Delete "$2"
    ${EndIf}
  creatordock_uninstall_registry_cleanup:
    DeleteRegValue HKCU "Software\CreatorDock" "DesktopShortcut"
  ${EndIf}

  ReadRegStr $3 HKCU "Software\CreatorDock" "StartMenuShortcut"
  ${If} $3 != ""
    IfFileExists "$3" 0 creatordock_uninstall_start_menu_registry_cleanup
    !insertmacro CreatorDock_IsShortcutTargetIgnoreCase "$3" "$INSTDIR\creator_dock.exe" creatordock_uninstall_start_menu_check
    Pop $8
    ${If} $8 = 1
      Delete "$3"
    ${EndIf}
  creatordock_uninstall_start_menu_registry_cleanup:
    DeleteRegValue HKCU "Software\CreatorDock" "StartMenuShortcut"
    ; Only removes the CreatorDock folder when no external entries remain.
    RMDir "$SMPROGRAMS\CreatorDock"
  ${EndIf}
!macroend
