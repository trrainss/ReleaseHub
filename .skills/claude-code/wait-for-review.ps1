param(
    [Parameter(Mandatory = $true)][string]$SessionDir,
    [Parameter(Mandatory = $true)][string]$RoundId,
    [ValidateSet("review", "next", "final")][string]$WaitFor = "review",
    [int]$TimeoutSec = 1800
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SessionDir -PathType Container)) {
    @{ status = "error"; reason = "session_dir_missing"; path = $SessionDir } |
        ConvertTo-Json -Compress
    exit 1
}

if ($RoundId -notmatch '^R\d+$') {
    @{ status = "error"; reason = "bad_round_id"; round = $RoundId } |
        ConvertTo-Json -Compress
    exit 1
}

function Get-NextRoundId {
    param([string]$Current)
    $number = [int]$Current.Substring(1)
    return "R$($number + 1)"
}

switch ($WaitFor) {
    "review" {
        $target = Join-Path $SessionDir "$RoundId-03-codex-review.md"
    }
    "next" {
        $nextRound = Get-NextRoundId $RoundId
        $target = Join-Path $SessionDir "$nextRound-01-round-start.md"
    }
    "final" {
        $target = Join-Path $SessionDir "final.md"
    }
}

$start = Get-Date
$deadline = $start.AddSeconds($TimeoutSec)

while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $target -PathType Leaf) {
        $elapsed = [int]((Get-Date) - $start).TotalSeconds
        @{
            status = "ready"
            wait_for = $WaitFor
            round = $RoundId
            path = $target
            elapsed_sec = $elapsed
        } | ConvertTo-Json -Compress
        exit 0
    }

    $elapsed = ((Get-Date) - $start).TotalSeconds
    if ($elapsed -lt 30) {
        $sleepSec = 2
    } elseif ($elapsed -lt 90) {
        $sleepSec = 5
    } else {
        $sleepSec = 10
    }

    Start-Sleep -Seconds $sleepSec
}

$elapsed = [int]((Get-Date) - $start).TotalSeconds
@{
    status = "timeout"
    wait_for = $WaitFor
    round = $RoundId
    path = $target
    elapsed_sec = $elapsed
} | ConvertTo-Json -Compress
exit 2
