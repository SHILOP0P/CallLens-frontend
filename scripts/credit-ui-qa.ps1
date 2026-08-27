param([string]$DebuggerUrl = "http://127.0.0.1:9223")
$ErrorActionPreference = "Stop"
$pages = Invoke-RestMethod "$DebuggerUrl/json"
$page = @($pages.GetEnumerator() | Where-Object { $_.type -eq "page" -and $_.url -like "http://127.0.0.1:4179/*" })[0]
if (-not $page) { throw "VerbaTrace page not found" }
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$webSocketUrl = [string]$page.webSocketDebuggerUrl
$socket.ConnectAsync([Uri]$webSocketUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
$script:id = 0
function Invoke-Cdp([string]$method, [hashtable]$params = @{}) {
  $script:id++
  $payload = @{ id = $script:id; method = $method; params = $params } | ConvertTo-Json -Compress -Depth 12
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  do {
    $stream = [IO.MemoryStream]::new()
    do {
      $buffer = New-Object byte[] 65536
      $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      $stream.Write($buffer, 0, $received.Count)
    } while (-not $received.EndOfMessage)
    $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
  } while ($message.id -ne $script:id)
  if ($message.error) { throw ($message.error | ConvertTo-Json -Compress) }
  return $message.result
}
function Invoke-JS([string]$expression, [bool]$awaitPromise = $false) {
  $result = Invoke-Cdp "Runtime.evaluate" @{ expression = $expression; returnByValue = $true; awaitPromise = $awaitPromise }
  if ($result.exceptionDetails) { throw ($result.exceptionDetails | ConvertTo-Json -Compress -Depth 8) }
  return $result.result.value
}
function Save-Screenshot([string]$path) {
  $result = Invoke-Cdp "Page.captureScreenshot" @{ format = "png"; captureBeyondViewport = $false }
  [IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($result.data))
}
function Wait-For([string]$expression) {
  for ($attempt=0; $attempt -lt 60; $attempt++) {
    if (Invoke-JS $expression) { return }
    Start-Sleep -Milliseconds 250
  }
  $diagnostic = Invoke-JS "(()=>({url:location.href,text:document.body.innerText.slice(0,1200),html:document.body.innerHTML.slice(0,500),errors:window.__qaErrors||[],overlay:document.querySelector('.vite-error-overlay,#webpack-dev-server-client-overlay')?.textContent||null}))()"
  throw "Timed out: $expression; state=$($diagnostic | ConvertTo-Json -Compress -Depth 5)"
}
Invoke-Cdp "Runtime.enable" | Out-Null
Invoke-Cdp "Page.enable" | Out-Null
Invoke-Cdp "Page.addScriptToEvaluateOnNewDocument" @{ source="window.__qaErrors=[];addEventListener('error',e=>window.__qaErrors.push(String(e.error?.stack||e.message)));addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason?.stack||e.reason)))" } | Out-Null
Invoke-JS "localStorage.setItem('verbatrace.theme.v1','dark');location.reload();true" | Out-Null
Start-Sleep -Milliseconds 500
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$register = @"
(async()=>{const response=await fetch('/api/v1/auth/register',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({email:'credit.qa.$suffix@example.com',password:'VisualQA-12345',full_name:'Credit',full_surname:'QA',username:'creditqa$suffix'})});return {status:response.status,body:await response.text()}})()
"@
$registration = Invoke-JS $register $true
$email = "credit.qa.$suffix@example.com"
if ($registration.status -ne 201) { throw "Registration failed: $($registration | ConvertTo-Json -Compress)" }
$login = Invoke-JS "(async()=>{const response=await fetch('/api/v1/auth/login',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({email:'$email',password:'VisualQA-12345'})});return {status:response.status,body:await response.text()}})()" $true
if ($login.status -ne 200) { throw "Login failed: $($login | ConvertTo-Json -Compress)" }
Invoke-JS "location.href='/app/settings/tariffs';true" | Out-Null
Wait-For "Boolean(document.querySelector('.credit-limit-ring'))"
$qaExpression = @"
(()=>{const root=document.querySelector('.credit-usage-panel');const rr=root.getBoundingClientRect();const overflow=[...root.querySelectorAll('*')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>document.documentElement.clientWidth+1||r.left<-1)}).map(el=>el.className||el.tagName);const collisions=[];const items=[...root.querySelectorAll('.credit-limit-row,.credit-activity-toolbar,.credit-heatmap,.credit-wallet-history')];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i].getBoundingClientRect(),b=items[j].getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)collisions.push([items[i].className,items[j].className])}return {width:rr.width,height:rr.height,overflow,collisions,bodyText:document.body.innerText.length,overlay:Boolean(document.querySelector('.vite-error-overlay,#webpack-dev-server-client-overlay'))}})()
"@
$dark = Invoke-JS $qaExpression
Save-Screenshot (Join-Path $PSScriptRoot "credit-dashboard-dark.png")
Invoke-JS "localStorage.setItem('verbatrace.theme.v1','light');location.reload();true" | Out-Null
Wait-For "Boolean(document.querySelector('.credit-limit-ring'))"
$light = Invoke-JS $qaExpression
Save-Screenshot (Join-Path $PSScriptRoot "credit-dashboard-light.png")
Invoke-Cdp "Emulation.setDeviceMetricsOverride" @{ width=390; height=844; deviceScaleFactor=1; mobile=$true } | Out-Null
Start-Sleep -Milliseconds 500
$mobile = Invoke-JS $qaExpression
Save-Screenshot (Join-Path $PSScriptRoot "credit-dashboard-mobile.png")
Invoke-Cdp "Emulation.clearDeviceMetricsOverride" | Out-Null
$integrationSeed = @"
(async()=>{const headers={'content-type':'application/json'};const appResponse=await fetch('/api/v1/developer/applications',{method:'POST',credentials:'include',headers,body:JSON.stringify({owner_type:'user',name:'Browser QA sandbox',environment:'sandbox',capabilities:['calls:write','calls:read','usage:read'],daily_credit_limit:25000,monthly_credit_limit:100000,max_credits_per_operation:10000})});if(!appResponse.ok)return {stage:'application',status:appResponse.status,body:await appResponse.text()};const app=await appResponse.json();const connectionsResponse=await fetch('/api/v1/developer/applications/'+app.application_uuid+'/connections',{credentials:'include'});if(!connectionsResponse.ok)return {stage:'connections',status:connectionsResponse.status,body:await connectionsResponse.text()};const connections=await connectionsResponse.json();const connection=connections.connections[0];const accountResponse=await fetch('/api/v1/integrations/'+connection.connection_uuid+'/service-accounts',{method:'POST',credentials:'include',headers,body:JSON.stringify({name:'Browser QA service',scopes:['calls:write','calls:read','usage:read']})});if(!accountResponse.ok)return {stage:'service-account',status:accountResponse.status,body:await accountResponse.text()};const account=await accountResponse.json();const keyResponse=await fetch('/api/v1/service-accounts/'+account.service_account_uuid+'/keys',{method:'POST',credentials:'include',headers,body:JSON.stringify({name:'Browser QA key',scopes:account.scopes})});return {stage:'complete',status:keyResponse.status,app:app.application_uuid,connection:connection.connection_uuid,account:account.service_account_uuid}})()
"@
$seed = Invoke-JS $integrationSeed $true
if ($seed.stage -ne 'complete' -or $seed.status -ne 201) { throw "Integration seed failed: $($seed | ConvertTo-Json -Compress -Depth 6)" }
Invoke-JS "location.href='/app/settings/integrations';true" | Out-Null
Wait-For "Boolean(document.querySelector('.integrations-page'))"
Wait-For "Boolean(document.querySelector('.integration-account-block'))"
$integrationChecks = @{}
foreach ($width in @(360,390,768,1024,1280,1440)) {
  Invoke-Cdp "Emulation.setDeviceMetricsOverride" @{ width=$width; height=900; deviceScaleFactor=1; mobile=($width -le 390) } | Out-Null
  Start-Sleep -Milliseconds 150
  $integrationChecks[[string]$width] = Invoke-JS "(()=>{const root=document.querySelector('.integrations-page');const visible=[...root.querySelectorAll('button,input,select,article,.integration-key-row')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0});const overflow=visible.filter(el=>{const r=el.getBoundingClientRect();return r.right>document.documentElement.clientWidth+1||r.left<-1}).map(el=>el.className||el.tagName);const cramped=visible.filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return (el.matches('button,input,select')&&(r.height<32||parseFloat(s.paddingLeft)<6||parseFloat(s.paddingRight)<6))}).map(el=>el.className||el.tagName);return {bodyText:root.innerText.length,overflow,cramped,overlay:Boolean(document.querySelector('.vite-error-overlay,#webpack-dev-server-client-overlay'))}})()"
}
Invoke-Cdp "Emulation.setDeviceMetricsOverride" @{ width=1440; height=900; deviceScaleFactor=1; mobile=$false } | Out-Null
Invoke-JS "document.querySelector('.integration-account-block').scrollIntoView({block:'center'});true" | Out-Null
Start-Sleep -Milliseconds 150
$integration = $integrationChecks
Save-Screenshot (Join-Path $PSScriptRoot "integrations-light.png")
$socket.Dispose()
@{ dark=$dark; light=$light; mobile=$mobile; integration=$integration } | ConvertTo-Json -Depth 8
