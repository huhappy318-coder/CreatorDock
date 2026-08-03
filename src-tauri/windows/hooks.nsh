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

  ; Tauri's default template writes CreatorDock.lnk. Temporarily hold an
  ; unrelated link inside the installer directory, then restore it after the
  ; new CreatorDock link has been moved to a suffix name.
  InitPluginsDir
  StrCpy $1 "$DESKTOP\CreatorDock.lnk"
  IfFileExists "$1" 0 creatordock_preinstall_done
  !insertmacro CreatorDock_IsShortcutTargetIgnoreCase "$1" "$INSTDIR\creator_dock.exe" creatordock_preinstall_check
  Pop $0
  ${If} $0 = 1
    Goto creatordock_preinstall_done
  ${EndIf}
  Rename "$1" "$PLUGINSDIR\CreatorDock-existing.lnk"
creatordock_preinstall_done:
!macroend

!macro NSIS_HOOK_POSTINSTALL
  IfFileExists "$PLUGINSDIR\CreatorDock-existing.lnk" 0 creator_dock_record_default
  IfFileExists "$DESKTOP\CreatorDock.lnk" creator_dock_find_registered creator_dock_create_default

creator_dock_create_default:
  CreateShortCut "$DESKTOP\CreatorDock.lnk" "$INSTDIR\creator_dock.exe" "" "$INSTDIR\creator_dock.exe" 0 SW_SHOWNORMAL

creator_dock_find_registered:
  ReadRegStr $2 HKCU "Software\CreatorDock" "DesktopShortcut"
  ${If} $2 != ""
    IfFileExists "$2" 0 creator_dock_find_suffix_start
    !insertmacro CreatorDock_IsShortcutTargetIgnoreCase "$2" "$INSTDIR\creator_dock.exe" creatordock_postinstall_check
    Pop $8
    ${If} $8 = 1
      Delete "$2"
      Goto creator_dock_move_new_shortcut
    ${EndIf}
  ${EndIf}

creator_dock_find_suffix_start:
  StrCpy $1 2
creator_dock_find_suffix:
  StrCpy $2 "$DESKTOP\CreatorDock ($1).lnk"
  IfFileExists "$2" 0 creator_dock_move_new_shortcut
  IntOp $1 $1 + 1
  Goto creator_dock_find_suffix

creator_dock_move_new_shortcut:
  Rename "$DESKTOP\CreatorDock.lnk" "$2"
  Rename "$PLUGINSDIR\CreatorDock-existing.lnk" "$DESKTOP\CreatorDock.lnk"
  WriteRegStr HKCU "Software\CreatorDock" "DesktopShortcut" "$2"
  Goto creator_dock_postinstall_done

creator_dock_record_default:
  StrCpy $2 "$DESKTOP\CreatorDock.lnk"
creator_dock_record_shortcut:
  WriteRegStr HKCU "Software\CreatorDock" "DesktopShortcut" "$2"
creator_dock_postinstall_done:
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
!macroend
