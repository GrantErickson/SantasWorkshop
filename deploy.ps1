<#
.SYNOPSIS
  Builds Santa's AI Workshop and deploys it to its Azure App Service site.

.DESCRIPTION
  Publishes a Release build, zips it, uploads it with `az webapp deploy`, then checks the site answers.
  Sign in first with `az login` using your IntelliTect account. Guests' data (App_Data) is never included.
  Deploying restarts the site: the TVs reconnect on their own, but a wish in progress on the kiosk would fail,
  so avoid deploying in the middle of the party.

.EXAMPLE
  ./deploy.ps1
#>
[CmdletBinding()]
param(
    [string]$Subscription = "Microsoft Partner Azure Sponsorship",
    [string]$ResourceGroup = "intellitect-santa",
    [string]$App = "intellitect-santa"
)

$ErrorActionPreference = "Stop"

az account show --subscription $Subscription --output none 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Can't reach the '$Subscription' subscription. Run 'az login' with your IntelliTect account, then try again."
}

# From here on, any failing dotnet or az command stops the script.
$PSNativeCommandUseErrorActionPreference = $true

$publish = Join-Path ([IO.Path]::GetTempPath()) "santas-workshop-publish"
$zip = Join-Path ([IO.Path]::GetTempPath()) "santas-workshop.zip"

Write-Host "Building..." -ForegroundColor Cyan
if (Test-Path $publish) { Remove-Item $publish -Recurse -Force }
dotnet publish (Join-Path $PSScriptRoot "src/SantasWorkshop") --configuration Release --output $publish --nologo --verbosity quiet
if (Test-Path (Join-Path $publish "App_Data")) {
    throw "The build output contains App_Data (guests' wishes and contact details). Not deploying."
}
Compress-Archive -Path (Join-Path $publish "*") -DestinationPath $zip -Force

Write-Host "Deploying to $App..." -ForegroundColor Cyan
az webapp deploy --subscription $Subscription --resource-group $ResourceGroup --name $App `
    --src-path $zip --type zip --output none

$url = "https://$App.azurewebsites.net"
$config = $null
for ($try = 0; $try -lt 24 -and -not $config; $try++) {
    # The site restarts after a deploy and can answer "service unavailable" for a little while.
    try { $config = Invoke-RestMethod "$url/api/config" -TimeoutSec 30 } catch { Start-Sleep -Seconds 5 }
}
if (-not $config) { throw "Deployed, but $url isn't answering after two minutes. Check the site in the Azure portal." }
$brain = if ($config.claudeEnabled) { "Claude" } else { "backup elf only (ANTHROPIC_API_KEY isn't set)" }
$pictures = if ($config.picturesEnabled) { "on" } else { "off (Workshop__Image* settings aren't set)" }
Write-Host "Deployed: $url  (elf brain: $brain; machine pictures: $pictures)" -ForegroundColor Green
