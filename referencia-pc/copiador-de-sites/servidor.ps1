# Servidor simples para abrir a cópia completa (com animações e 3D) no seu PC.
# Não precisa instalar nada. Feche esta janela para parar.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$porta = 8080
$l = $null
while ($true) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$porta/")
    $l.Start()
    break
  } catch {
    $porta++
    if ($porta -gt 8120) { Write-Host 'Nao achei porta livre.'; Read-Host 'Enter para sair'; exit 1 }
  }
}
function Get-Hash([string]$s) {
  [uint32]$h = 2166136261
  foreach ($c in $s.ToCharArray()) {
    $h = $h -bxor [uint32][int]$c
    $h = [uint32](([uint64]$h * [uint64]16777619) % [uint64]4294967296)
  }
  return '{0:x8}' -f $h
}
$rotas = @{}
$rf = Join-Path $raiz '_rotas.json'
if (Test-Path $rf) {
  $j = Get-Content $rf -Raw -Encoding UTF8 | ConvertFrom-Json
  $j.PSObject.Properties | ForEach-Object { $rotas[$_.Name] = $_.Value }
}
$tipos = @{}
$tf = Join-Path $raiz '_tipos.json'
if (Test-Path $tf) {
  $j = Get-Content $tf -Raw -Encoding UTF8 | ConvertFrom-Json
  $j.PSObject.Properties | ForEach-Object { $tipos[$_.Name] = $_.Value }
}
$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8';
  '.cjs'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.map'='application/json';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.webp'='image/webp';
  '.avif'='image/avif'; '.ico'='image/x-icon'; '.bmp'='image/bmp'; '.woff'='font/woff'; '.woff2'='font/woff2'; '.ttf'='font/ttf'; '.otf'='font/otf';
  '.eot'='application/vnd.ms-fontobject'; '.mp4'='video/mp4'; '.webm'='video/webm'; '.mov'='video/quicktime'; '.mp3'='audio/mpeg'; '.wav'='audio/wav';
  '.ogg'='audio/ogg'; '.wasm'='application/wasm'; '.glb'='model/gltf-binary'; '.gltf'='model/gltf+json'; '.bin'='application/octet-stream';
  '.hdr'='application/octet-stream'; '.exr'='application/octet-stream'; '.ktx2'='image/ktx2'; '.txt'='text/plain; charset=utf-8';
  '.xml'='application/xml'; '.webmanifest'='application/manifest+json'; '.lottie'='application/zip'; '.riv'='application/octet-stream'
}
Write-Host ""
Write-Host "  Site rodando em http://localhost:$porta/"
Write-Host "  Feche esta janela para desligar."
Write-Host ""
Start-Process "http://localhost:$porta/"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $caminho = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
    $chave = $caminho + $req.Url.Query
    $metodo = $req.HttpMethod.ToUpper()
    if ($metodo -eq 'OPTIONS') {
      $res.AddHeader('Access-Control-Allow-Origin', '*')
      $res.AddHeader('Access-Control-Allow-Headers', '*')
      $res.AddHeader('Access-Control-Allow-Methods', '*')
      $res.StatusCode = 204
      continue
    }
    $achou = $null
    if ($metodo -ne 'GET' -and $metodo -ne 'HEAD') {
      $corpo = ''
      if ($req.HasEntityBody) {
        $leitor = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $corpo = $leitor.ReadToEnd()
        $leitor.Close()
      }
      $tentativas = @("$metodo $chave #$(Get-Hash $corpo)", "$metodo $chave", "$metodo $caminho", $chave)
    } else {
      $tentativas = @($chave)
    }
    if ($req.Headers['RSC']) { $tentativas = @("RSC $chave", "RSC $caminho") + $tentativas }
    foreach ($t in $tentativas) { if ($rotas.ContainsKey($t)) { $achou = $rotas[$t]; break } }
    if (-not $achou -and -not $caminho.EndsWith('/') -and $rotas.ContainsKey($caminho)) {
      $teste = Join-Path $raiz ($caminho.TrimStart('/') -replace '/', '\')
      if (-not (Test-Path $teste -PathType Leaf)) { $achou = $rotas[$caminho] }
    }
    if ($achou) { $caminho = $achou }
    $rel = $caminho.TrimStart('/') -replace '/', '\'
    $arq = Join-Path $raiz $rel
    if (Test-Path $arq -PathType Container) { $arq = Join-Path $arq 'index.html' }
    if (-not (Test-Path $arq -PathType Leaf)) {
      if (Test-Path ($arq + '.html') -PathType Leaf) { $arq = $arq + '.html' }
      elseif (-not [IO.Path]::HasExtension($arq) -and ($metodo -eq 'GET') -and ("$($req.Headers['Accept'])" -match 'text/html')) { $arq = Join-Path $raiz 'index.html' }
    }
    if (Test-Path $arq -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($arq).ToLower()
      $relArq = '/' + $arq.Substring($raiz.Length).TrimStart('\').Replace('\', '/')
      if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] }
      elseif ($tipos.ContainsKey($relArq)) { $res.ContentType = $tipos[$relArq] }
      else { $res.ContentType = 'application/octet-stream' }
      $res.AddHeader('Access-Control-Allow-Origin', '*')
      $bytes = [IO.File]::ReadAllBytes($arq)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.OutputStream.Close() } catch {}
  }
}
