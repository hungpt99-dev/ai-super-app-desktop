"""Update docs: rename Mini-App → Bot, remove workspace references."""

replacements = [
    ("Mini-App Ecosystem", "Bot Ecosystem"),
    ("Mini-App Framework", "Bot Framework"),
    ("Mini-App Marketplace", "Bot Marketplace"),
    ("Mini-App SDK", "Bot SDK"),
    ("Mini-App Manager", "Bot Manager"),
    ("Mini-App UI Renderer", "Bot UI Renderer"),
    ("Mini-App UI", "Bot UI"),
    ("Mini-App module", "Bot module"),
    ("Mini-App code", "Bot code"),
    ("Mini-App bundle", "Bot bundle"),
    ("Mini-App Package", "Bot Package"),
    ("Mini-App package", "Bot package"),
    ("Mini-App logic", "Bot logic"),
    ("Mini-App metadata", "Bot metadata"),
    ("Mini-App must", "Bot must"),
    ("Mini-App cannot", "Bot cannot"),
    ("Mini-App monetization", "Bot monetization"),
    ("Mini-App bundles", "Bot bundles"),
    ("Mini-App Panel", "Bot Panel"),
    ("Mini-App panel", "Bot panel"),
    ("Mini-App task", "Bot task"),
    ("Mini-App's dedicated", "Bot's dedicated"),
    ("Mini-App is installed", "Bot is installed"),
    ("Mini-App is backed", "Bot is backed"),
    ("a Mini-App", "a Bot"),
    ("each Mini-App", "each Bot"),
    ("Every installed Mini-App", "Every installed Bot"),
    ("Mini-Apps are modular", "Bots are modular"),
    ("2–3 Mini-Apps", "2–3 Bots"),
    ("2 Mini-Apps", "2 Bots"),
    ("Malicious Mini-App", "Malicious Bot"),
    ("Mini-Apps = ", "Bots = "),
    ("Mini-Apps.", "Bots."),
    ("Mini-Apps,", "Bots,"),
    ("Mini-Apps", "Bots"),
    ("Mini-App", "Bot"),
    ("miniapps/", "bots/"),
    ("MiniAppVersions", "BotVersions"),
    ("MiniApps", "Bots"),
    ("- Workspace management\n", ""),
    ("- Manage workspace\n", ""),
]

files = [
    "/Users/phamthanhhung/Desktop/MyProject/ai-super-app-desktop/docs/product-concept.md",
    "/Users/phamthanhhung/Desktop/MyProject/ai-super-app-desktop/docs/technical-architecture.md",
]

for path in files:
    with open(path, "r") as f:
        text = f.read()
    for old, new in replacements:
        text = text.replace(old, new)
    with open(path, "w") as f:
        f.write(text)
    print(f"Updated: {path}")

print("Done")
