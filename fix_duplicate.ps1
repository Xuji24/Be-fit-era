$file = 'app/actions/admin-actions.ts'
$text = Get-Content $file -Raw

$pattern = '(?s)export async function rejectDispute\(id: string\): Promise<\{ success: boolean; error\?: string \}> \{.*?(?=\nexport|$)'
$matches = [regex]::Matches($text, $pattern)

if ($matches.Count -gt 1) {
    # Remove the second match
    $text = $text.Remove($matches[1].Index, $matches[1].Length)
    Set-Content $file -Value $text
    Write-Host "Removed duplicate rejectDispute"
} else {
    Write-Host "No duplicate found using regex, let me read the whole file"
}
