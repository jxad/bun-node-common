export async function SettingsLoader<TSettings>(settingsPath: string, settingsLocalPath: string): Promise<TSettings | undefined> {
  function loadSettings(rawSettings: any): TSettings | undefined {
    if (!rawSettings) return undefined

    return rawSettings
  }

  function mergeSettings(baseSettings: TSettings, localSettings: TSettings | undefined): TSettings {
    if (!localSettings) return baseSettings

    return { ...baseSettings, ...localSettings }
  }

  let baseSettings: TSettings | undefined
  try {
    const baseModule = await import(settingsPath)
    baseSettings = loadSettings(baseModule.default || baseModule)
    if (!baseSettings) return undefined
  } catch (err) {
    console.error(`Error loading settings.json file: ${(err as Error).message}`)
    return undefined
  }

  var localSettings
  try {
    const localModule = await import(settingsLocalPath)
    const settings = localModule.default || localModule
    localSettings = loadSettings(settings)
    return mergeSettings(baseSettings, localSettings)
  } catch (err) {
    console.error(`Error loading settings.local.json: ${(err as Error).message}. \nApplication is going to use only base settings`)
    return baseSettings
  }
}