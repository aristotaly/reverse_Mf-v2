# Adds the v2 env vars to all 3 Vercel environments using cmd's echo
# pipeline (PowerShell's stdin redirect into npx is unreliable on Windows).
$ErrorActionPreference = "Continue"
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"

$direct = (Select-String -Path .env.v2-db -Pattern 'POSTGRES_URL_NON_POOLING="(.+?)"').Matches[0].Groups[1].Value
$pooled = (Select-String -Path .env.v2-db -Pattern 'POSTGRES_PRISMA_URL="(.+?)"').Matches[0].Groups[1].Value
$sessionSecret = -join ((1..48) | ForEach-Object { Get-Random -InputObject @('a','b','c','d','e','f','0','1','2','3','4','5','6','7','8','9') })

if ($direct.Length -lt 50) { throw "Direct URL too short. Read .env.v2-db" }
if ($pooled.Length -lt 50) { throw "Pooled URL too short. Read .env.v2-db" }

$vars = @(
  @{ name = "POSTGRES_URL_NON_POOLING"; value = $direct },
  @{ name = "POSTGRES_PRISMA_URL";      value = $pooled },
  @{ name = "SESSION_SECRET";           value = $sessionSecret },
  @{ name = "SEED_PASSCODE";            value = "Amdocs101" },
  @{ name = "SEED_USERNAME";            value = "admin" },
  @{ name = "SEED_USER_NAME";           value = "Admin" }
)

$targetEnvs = if ($args.Count -gt 0) { $args } else { @("production", "preview", "development") }
$tmp = New-TemporaryFile

foreach ($envName in $targetEnvs) {
  Write-Host "--- $envName ---"
  foreach ($v in $vars) {
    # Write the value to a temp file (no trailing newline) and redirect into
    # npx stdin via cmd. Production + Development accept stdin and --yes;
    # Preview cannot be set without a connected git branch so we skip it.
    [System.IO.File]::WriteAllText($tmp.FullName, $v.value, [System.Text.UTF8Encoding]::new($false))
    $output = cmd /c "npx vercel env add $($v.name) $envName --yes < `"$($tmp.FullName)`"" 2>&1
    $success = ($output | Select-String -Pattern 'Added Environment Variable' -Quiet)
    $tail = ($output | Select-Object -Last 1)
    $status = if ($success) { "OK" } else { "FAILED: $tail" }
    Write-Host "  $($v.name) => $status"
  }
}
Remove-Item $tmp.FullName -ErrorAction SilentlyContinue

Write-Host "done"
