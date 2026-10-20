param([switch]$Uninstall)
$ClientDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$Startup = [Environment]::GetFolderPath('Startup')
$Launcher = Join-Path $Startup 'MysAuth Cloud Backup.vbs'
if ($Uninstall) {
  Remove-Item -LiteralPath $Launcher -Force -ErrorAction SilentlyContinue
  Write-Host 'Inicio automatico eliminado.'
  exit 0
}
$clientScript = Join-Path $ClientDir 'client.js'
$lines = @(
  'Set WshShell = CreateObject("WScript.Shell")'
  ('WshShell.CurrentDirectory = "' + $ClientDir + '"')
  ('WshShell.Run Chr(34) & "' + $Node + '" & Chr(34) & " " & Chr(34) & "' + $clientScript + '" & Chr(34), 0, False')
)
$crlf=[string][char]13+[char]10
[IO.File]::WriteAllText($Launcher, ($lines -join $crlf) + $crlf, [Text.Encoding]::ASCII)
Write-Host 'Inicio automatico configurado en la carpeta de inicio de Windows.'
