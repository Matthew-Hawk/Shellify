param(
    [Parameter(Mandatory)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Import-Module PSScriptAnalyzer -RequiredVersion 1.24.0 -ErrorAction Stop

# Use a fresh directory so removed templates cannot leave stale scripts in the scan.
if (Test-Path -LiteralPath $OutputDirectory) {
    throw "Analysis output directory already exists: $OutputDirectory. Choose a new directory."
}
$generator = Join-Path $PSScriptRoot 'generate-analysis-scripts.js'
node --input-type=module -e 'import {pathToFileURL} from "node:url"; const {writeAnalysisScripts}=await import(pathToFileURL(process.argv[1])); await writeAnalysisScripts(process.argv[2]);' $generator $OutputDirectory
if ($LASTEXITCODE -ne 0) { throw 'Generating command scripts failed.' }

function ConvertTo-AnnotationValue([string]$Value, [switch]$Property) {
    $escaped = $Value.Replace('%', '%25').Replace("`r", '%0D').Replace("`n", '%0A')
    if ($Property) { $escaped = $escaped.Replace(':', '%3A').Replace(',', '%2C') }
    $escaped
}

$scripts = @(Get-ChildItem -LiteralPath $OutputDirectory -Filter '*.ps1' -File)
if ($scripts.Count -eq 0) { throw 'No generated scripts to analyze.' }
$errorCount = 0
$warningCount = 0
foreach ($script in $scripts) {
    # Literal target examples are intentional in this template. See docs/development.md.
    $excludedRules = @()
    if ($script.Name -in @('lockout-events-ps5.1.ps1', 'lockout-events-ps7.ps1')) {
        $excludedRules = @('PSAvoidUsingComputerNameHardcoded')
    }
    # Scripts are analyzed, never invoked. No settings profile overrides default rules.
    $findings = @(Invoke-ScriptAnalyzer -Path $script.FullName -ExcludeRule $excludedRules -ErrorAction Stop)
    foreach ($finding in $findings) {
        $severity = [string]$finding.Severity
        if ($severity -notin @('Error', 'ParseError', 'Warning')) { continue }
        $level = if ($severity -eq 'Warning') { 'warning' } else { 'error' }
        if ($level -eq 'error') { $errorCount++ } else { $warningCount++ }
        $file = ConvertTo-AnnotationValue $script.FullName -Property
        $message = ConvertTo-AnnotationValue "$($script.Name): [$($finding.RuleName)] $($finding.Message)"
        $line = [Math]::Max(1, $finding.Line)
        $column = [Math]::Max(1, $finding.Column)
        Write-Output "::${level} file=$file,line=$line,col=$column::$message"
    }
}
Write-Output "Analyzed $($scripts.Count) scripts: $errorCount errors, $warningCount warnings."
if ($errorCount -gt 0) { throw "PSScriptAnalyzer found $errorCount errors in generated templates." }
