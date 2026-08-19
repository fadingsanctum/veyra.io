[Setup]
AppName=Veyra
AppVersion=1.0.0
DefaultDirName={localappdata}\Veyra
DefaultGroupName=Veyra
OutputBaseFilename=VeyraSetup
OutputDir=..\..\dist
Compression=lzma2
SolidCompression=yes

[Files]
; Engine executable (lives in engine/ root, not bin/)
Source: "..\..\engine\veyra-engine.exe"; DestDir: "{app}"; Flags: ignoreversion
; All binaries + DLLs in engine/bin/ → {app}/bin/
Source: "..\..\engine\bin\*"; DestDir: "{app}\bin"; Flags: ignoreversion recursesubdirs
; Silent launcher
Source: "start.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Run]
; Launch engine after install (hidden, no console)
Filename: "{sys}\wscript.exe"; Parameters: "{app}\start.vbs"; Flags: nowait postinstall; Description: "Launch Veyra engine"
; Register scheduled task for autostart on logon
Filename: "{sys}\schtasks.exe"; Parameters: "/create /tn VeyraEngine /tr ""{app}\start.vbs"" /sc onlogon /f"; Flags: runhidden

[UninstallRun]
Filename: "{sys}\schtasks.exe"; Parameters: "/delete /tn VeyraEngine /f"; Flags: runhidden
