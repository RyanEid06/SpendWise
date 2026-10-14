$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$manifest = [xml](Get-Content -LiteralPath (Join-Path $taskRoot 'android/app/src/main/AndroidManifest.xml') -Raw)
$androidNamespace = 'http://schemas.android.com/apk/res/android'
$hostNode = @($manifest.manifest.application.activity) | Where-Object { $_.GetAttribute('name', $androidNamespace) -eq '.SpendWiseAuthenticationActivity' }
if (!$hostNode -or $hostNode.GetAttribute('exported', $androidNamespace) -ne 'false') { throw 'Authentication host must be private.' }
$themeName = $hostNode.GetAttribute('theme', $androidNamespace) -replace '^@style/', ''
$expected = @{
    'windowActionBar' = 'false'; 'windowNoTitle' = 'true';
    'android:windowActionBar' = 'false'; 'android:windowNoTitle' = 'true';
    'android:windowIsTranslucent' = 'true'; 'android:windowIsFloating' = 'false';
    'android:windowBackground' = '@android:color/transparent';
    'android:backgroundDimEnabled' = 'false'; 'android:windowDisablePreview' = 'true'
}
foreach ($configuration in @('day-api24', 'night-api24', 'day-api27', 'night-api27')) {
    $stylesByName = @{}
    $qualifiers = @('values')
    if ($configuration.StartsWith('night')) { $qualifiers += 'values-night' }
    if ($configuration.EndsWith('api27')) {
        $qualifiers += 'values-v27'
        if ($configuration.StartsWith('night')) { $qualifiers += 'values-night-v27' }
    }
    foreach ($qualifier in $qualifiers) {
        $resource = [xml](Get-Content -LiteralPath (Join-Path $taskRoot "android/app/src/main/res/$qualifier/styles.xml") -Raw)
        foreach ($style in @($resource.resources.style)) { $stylesByName[$style.GetAttribute('name')] = $style }
    }
    $effective = @{}
    $cursor = $themeName
    $visited = @{}
    while ($stylesByName.ContainsKey($cursor)) {
        if ($visited.ContainsKey($cursor)) { throw "Style inheritance cycle: $cursor" }
        $visited[$cursor] = $true
        $style = $stylesByName[$cursor]
        foreach ($item in $style.SelectNodes('item')) {
            if ($null -ne $item -and !$effective.ContainsKey($item.GetAttribute('name'))) {
                $effective[$item.GetAttribute('name')] = $item.InnerText
            }
        }
        $cursor = $style.GetAttribute('parent') -replace '^@style/', ''
    }
    foreach ($attribute in $expected.Keys) {
        if ($effective[$attribute] -ne $expected[$attribute]) {
            throw "$configuration host theme $themeName resolves $attribute='$($effective[$attribute])'; expected '$($expected[$attribute])'."
        }
    }
    Write-Output "PASS $configuration manifest-resolved host theme: no action bar, transparent, non-floating, no dim or preview."
}
$hostSource = Get-Content -LiteralPath (Join-Path $taskRoot 'android/app/src/main/java/com/spendwise/app/SpendWiseAuthenticationActivity.java') -Raw
if ($hostSource -notmatch 'getWindow\(\)\.addFlags\(WindowManager\.LayoutParams\.FLAG_SECURE\)') { throw 'Host must retain FLAG_SECURE.' }
if ($hostSource -match 'FLAG_NOT_TOUCHABLE|FLAG_NOT_TOUCH_MODAL|FLAG_SHOW_WHEN_LOCKED|FLAG_DISMISS_KEYGUARD|setShowWhenLocked|setTurnScreenOn') { throw 'Host must not add touch-through or keyguard flags.' }
foreach ($attribute in @('showWhenLocked', 'turnScreenOn')) {
    if ($hostNode.GetAttribute($attribute, $androidNamespace) -eq 'true') { throw "Unexpected host manifest $attribute." }
}
Write-Output 'PASS host retains secure, focusable/touch-modal window defaults and no keyguard privileges.'
