import { execFile } from 'node:child_process'

// Toast nativo via WinRT do PowerShell 5.1 (o pwsh 7 não tem a projeção). Textos vão por variável de ambiente,
// nunca concatenados no comando, para não haver injeção.
const SCRIPT = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$n = $t.GetElementsByTagName('text')
$n.Item(0).AppendChild($t.CreateTextNode($env:MTM_TITULO)) | Out-Null
$n.Item(1).AppendChild($t.CreateTextNode($env:MTM_TEXTO)) | Out-Null
$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($t))
`

export function notificarWindows(titulo: string, texto: string) {
  if (process.platform !== 'win32') return
  execFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT],
    { env: { ...process.env, MTM_TITULO: titulo, MTM_TEXTO: texto }, timeout: 10_000, windowsHide: true },
    (erro) => erro && console.error('notificação do Windows falhou:', erro.message),
  )
}
