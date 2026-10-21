# VoxMind - Service Health and Connectivity Diagnostic Script
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  VoxMind - Runtime Diagnostics and Service Verification" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$services = @(
    @{ Name = "Express Backend API"; Host = "127.0.0.1"; Port = 5000; Path = "/health" },
    @{ Name = "FastAPI AI Microservice"; Host = "127.0.0.1"; Port = 8000; Path = "/health" },
    @{ Name = "MongoDB Document Store"; Host = "127.0.0.1"; Port = 27017 },
    @{ Name = "Redis Queue / Cache"; Host = "127.0.0.1"; Port = 6379 },
    @{ Name = "Ollama Local LLM"; Host = "127.0.0.1"; Port = 11434; Path = "/api/tags" }
)

foreach ($svc in $services) {
    $tcp = New-Object Net.Sockets.TcpClient
    $portOpen = $false
    try {
        $tcp.Connect($svc.Host, $svc.Port)
        $portOpen = $true
        $tcp.Close()
    } catch {
        $portOpen = $false
    }

    $svcName = $svc.Name
    $svcPort = $svc.Port

    if ($portOpen) {
        if ($svc.Path) {
            try {
                $uri = "http://" + $svc.Host + ":" + $svc.Port + $svc.Path
                $resp = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 2
                $json = $resp | ConvertTo-Json -Compress
                if ($resp.status -eq "healthy") {
                    Write-Host " [ONLINE]  $svcName on port $svcPort (Healthy)" -ForegroundColor Green
                } else {
                    Write-Host " [COLLISION] $svcName port $svcPort occupied by third-party process" -ForegroundColor Yellow
                    Write-Host "             Response: $json" -ForegroundColor DarkGray
                }
            } catch {
                Write-Host " [ONLINE]  $svcName port $svcPort open, but health check failed: $_" -ForegroundColor Yellow
            }
        } else {
            Write-Host " [ONLINE]  $svcName on port $svcPort" -ForegroundColor Green
        }
    } else {
        Write-Host " [OFFLINE] $svcName on port $svcPort (connection refused)" -ForegroundColor DarkGray
    }
}

Write-Host "----------------------------------------------------------" -ForegroundColor Cyan

try {
    $dockerInfo = docker ps --format "{{.Names}}`t{{.Status}}" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " [ONLINE]  Docker Engine is running." -ForegroundColor Green
        if ($dockerInfo) {
            Write-Host "           Active Containers:" -ForegroundColor Gray
            $dockerInfo | ForEach-Object { Write-Host "           - $_" -ForegroundColor Gray }
        } else {
            Write-Host "           (No VoxMind containers currently running)" -ForegroundColor Gray
        }
    } else {
        Write-Host " [OFFLINE] Docker Engine is not currently running on host." -ForegroundColor DarkGray
    }
} catch {
    Write-Host " [OFFLINE] Docker CLI not accessible." -ForegroundColor DarkGray
}
Write-Host "==========================================================" -ForegroundColor Cyan
