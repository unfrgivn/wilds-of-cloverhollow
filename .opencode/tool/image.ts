import { tool } from "@opencode-ai/plugin"

/*
  Image generation tool using Gemini CLI with the nanobanana extension.
  
  Prerequisites:
  1. Gemini CLI installed and configured
  2. nanobanana extension installed: gemini extensions install https://github.com/gemini-cli-extensions/nanobanana
  3. API key set via NANOBANANA_GEMINI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY
  
  Optional: Set NANOBANANA_MODEL=gemini-3-pro-image-preview for Nano Banana Pro
  
  Generated images are saved to ./nanobanana-output/
*/

const outputDir = "nanobanana-output"

export const generate = tool({
  description: "Generate images from text prompts using Gemini CLI nanobanana extension",
  args: {
    prompt: tool.schema.string().describe("Descriptive prompt for image generation"),
    count: tool.schema.number().min(1).max(8).default(1).describe("Number of variations (1-8)"),
    styles: tool.schema.string().optional().describe("Comma-separated styles: photorealistic, watercolor, oil-painting, sketch, pixel-art, anime, vintage, modern, abstract, minimalist"),
    variations: tool.schema.string().optional().describe("Comma-separated variations: lighting, angle, color-palette, composition, mood, season, time-of-day"),
    preview: tool.schema.boolean().default(false).describe("Open generated images in default viewer"),
  },
  async execute(args) {
    const cmdParts = [`/generate "${args.prompt}"`]
    if (args.count > 1) cmdParts.push(`--count=${args.count}`)
    if (args.styles) cmdParts.push(`--styles="${args.styles}"`)
    if (args.variations) cmdParts.push(`--variations="${args.variations}"`)
    if (args.preview) cmdParts.push("--preview")

    const geminiCmd = cmdParts.join(" ")
    const result = await Bun.$`gemini --yolo -p ${geminiCmd}`.text()
    return `Command: gemini --yolo -p '${geminiCmd}'\n\nOutput:\n${result}\n\nImages saved to ./${outputDir}/`
  },
})

export const edit = tool({
  description: "Edit an existing image with natural language instructions",
  args: {
    imagePath: tool.schema.string().describe("Path to the image file to edit"),
    instruction: tool.schema.string().describe("Natural language instruction for how to edit the image"),
    preview: tool.schema.boolean().default(false).describe("Open edited image in default viewer"),
  },
  async execute(args) {
    const cmdParts = [`/edit ${args.imagePath} "${args.instruction}"`]
    if (args.preview) cmdParts.push("--preview")

    const geminiCmd = cmdParts.join(" ")
    const result = await Bun.$`gemini --yolo -p ${geminiCmd}`.text()
    return `Command: gemini --yolo -p '${geminiCmd}'\n\nOutput:\n${result}\n\nEdited image saved to ./${outputDir}/`
  },
})

export const icon = tool({
  description: "Generate app icons, favicons, and UI elements in multiple sizes",
  args: {
    prompt: tool.schema.string().describe("Description of the icon to generate"),
    sizes: tool.schema.string().default("64,128,256").describe("Comma-separated sizes in pixels (e.g., '16,32,64,128,256,512')"),
    type: tool.schema.enum(["app-icon", "favicon", "ui-element"]).default("app-icon").describe("Icon type"),
    style: tool.schema.enum(["flat", "skeuomorphic", "minimal", "modern"]).default("modern").describe("Visual style"),
    background: tool.schema.enum(["transparent", "white", "black"]).default("transparent").describe("Background type"),
    preview: tool.schema.boolean().default(false).describe("Open generated icons in default viewer"),
  },
  async execute(args) {
    const cmdParts = [`/icon "${args.prompt}"`]
    cmdParts.push(`--sizes="${args.sizes}"`)
    cmdParts.push(`--type="${args.type}"`)
    cmdParts.push(`--style="${args.style}"`)
    cmdParts.push(`--background="${args.background}"`)
    if (args.preview) cmdParts.push("--preview")

    const geminiCmd = cmdParts.join(" ")
    const result = await Bun.$`gemini --yolo -p ${geminiCmd}`.text()
    return `Command: gemini --yolo -p '${geminiCmd}'\n\nOutput:\n${result}\n\nIcons saved to ./${outputDir}/`
  },
})

export const pattern = tool({
  description: "Generate seamless patterns and textures for backgrounds",
  args: {
    prompt: tool.schema.string().describe("Description of the pattern to generate"),
    type: tool.schema.enum(["seamless", "texture", "wallpaper"]).default("seamless").describe("Pattern type"),
    style: tool.schema.enum(["geometric", "organic", "abstract", "floral", "tech"]).default("abstract").describe("Pattern style"),
    density: tool.schema.enum(["sparse", "medium", "dense"]).default("medium").describe("Element density"),
    colors: tool.schema.enum(["mono", "duotone", "colorful"]).default("colorful").describe("Color scheme"),
    preview: tool.schema.boolean().default(false).describe("Open generated pattern in default viewer"),
  },
  async execute(args) {
    const cmdParts = [`/pattern "${args.prompt}"`]
    cmdParts.push(`--type="${args.type}"`)
    cmdParts.push(`--style="${args.style}"`)
    cmdParts.push(`--density="${args.density}"`)
    cmdParts.push(`--colors="${args.colors}"`)
    if (args.preview) cmdParts.push("--preview")

    const geminiCmd = cmdParts.join(" ")
    const result = await Bun.$`gemini --yolo -p ${geminiCmd}`.text()
    return `Command: gemini --yolo -p '${geminiCmd}'\n\nOutput:\n${result}\n\nPattern saved to ./${outputDir}/`
  },
})

export const story = tool({
  description: "Generate sequential images that tell a visual story or demonstrate a process",
  args: {
    prompt: tool.schema.string().describe("Description of the story or process to visualize"),
    steps: tool.schema.number().min(2).max(8).default(4).describe("Number of sequential images (2-8)"),
    type: tool.schema.enum(["story", "process", "tutorial", "timeline"]).default("story").describe("Sequence type"),
    style: tool.schema.enum(["consistent", "evolving"]).default("consistent").describe("Visual consistency across frames"),
    layout: tool.schema.enum(["separate", "grid", "comic"]).default("separate").describe("Output layout"),
    preview: tool.schema.boolean().default(false).describe("Open generated images in default viewer"),
  },
  async execute(args) {
    const cmdParts = [`/story "${args.prompt}"`]
    cmdParts.push(`--steps=${args.steps}`)
    cmdParts.push(`--type="${args.type}"`)
    cmdParts.push(`--style="${args.style}"`)
    cmdParts.push(`--layout="${args.layout}"`)
    if (args.preview) cmdParts.push("--preview")

    const geminiCmd = cmdParts.join(" ")
    const result = await Bun.$`gemini --yolo -p ${geminiCmd}`.text()
    return `Command: gemini --yolo -p '${geminiCmd}'\n\nOutput:\n${result}\n\nStory images saved to ./${outputDir}/`
  },
})

export const diagram = tool({
  description: "Generate technical diagrams, flowcharts, and architectural mockups",
  args: {
    prompt: tool.schema.string().describe("Description of the diagram to generate"),
    type: tool.schema.enum(["flowchart", "architecture", "network", "database", "wireframe", "mindmap", "sequence"]).default("flowchart").describe("Diagram type"),
    style: tool.schema.enum(["professional", "clean", "hand-drawn", "technical"]).default("professional").describe("Visual style"),
    layout: tool.schema.enum(["horizontal", "vertical", "hierarchical", "circular"]).default("hierarchical").describe("Layout orientation"),
    complexity: tool.schema.enum(["simple", "detailed", "comprehensive"]).default("detailed").describe("Level of detail"),
    preview: tool.schema.boolean().default(false).describe("Open generated diagram in default viewer"),
  },
  async execute(args) {
    const cmdParts = [`/diagram "${args.prompt}"`]
    cmdParts.push(`--type="${args.type}"`)
    cmdParts.push(`--style="${args.style}"`)
    cmdParts.push(`--layout="${args.layout}"`)
    cmdParts.push(`--complexity="${args.complexity}"`)
    if (args.preview) cmdParts.push("--preview")

    const geminiCmd = cmdParts.join(" ")
    const result = await Bun.$`gemini --yolo -p ${geminiCmd}`.text()
    return `Command: gemini --yolo -p '${geminiCmd}'\n\nOutput:\n${result}\n\nDiagram saved to ./${outputDir}/`
  },
})

export const restore = tool({
  description: "Restore and enhance old or damaged photos",
  args: {
    imagePath: tool.schema.string().describe("Path to the image file to restore"),
    instruction: tool.schema.string().describe("Restoration instructions (e.g., 'remove scratches and improve clarity')"),
    preview: tool.schema.boolean().default(false).describe("Open restored image in default viewer"),
  },
  async execute(args) {
    const cmdParts = [`/restore ${args.imagePath} "${args.instruction}"`]
    if (args.preview) cmdParts.push("--preview")

    const geminiCmd = cmdParts.join(" ")
    const result = await Bun.$`gemini --yolo -p ${geminiCmd}`.text()
    return `Command: gemini --yolo -p '${geminiCmd}'\n\nOutput:\n${result}\n\nRestored image saved to ./${outputDir}/`
  },
})

export const nanobanana = tool({
  description: "Natural language interface for flexible image generation requests",
  args: {
    request: tool.schema.string().describe("Natural language request for image generation, editing, or any creative task"),
  },
  async execute(args) {
    const geminiCmd = `/nanobanana ${args.request}`
    const result = await Bun.$`gemini --yolo -p ${geminiCmd}`.text()
    return `Command: gemini --yolo -p '${geminiCmd}'\n\nOutput:\n${result}\n\nOutput saved to ./${outputDir}/`
  },
})
