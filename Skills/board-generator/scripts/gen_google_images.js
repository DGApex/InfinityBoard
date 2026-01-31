import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const envPath = path.join(__dirname, '.env');

// --- Load API Key manually if not in process.env ---
function loadApiKey() {
    if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
    if (fs.existsSync(envPath)) {
        try {
            const content = fs.readFileSync(envPath, 'utf8');
            const match = content.match(/GOOGLE_API_KEY=(.*)/);
            if (match && match[1]) return match[1].trim();
        } catch (e) {
            // ignore
        }
    }
    return null;
}

const apiKey = loadApiKey();
if (!apiKey) {
    console.error("Error: GOOGLE_API_KEY not found in environment or .env file.");
    process.exit(1);
}

process.env.GOOGLE_API_KEY = apiKey;
const ai = new GoogleGenAI({});

// --- Arguments ---
const args = process.argv.slice(2);
const positionalArgs = args.filter(a => !a.startsWith('--'));
const flags = args.filter(a => a.startsWith('--'));

const inputTopic = positionalArgs[0];
const outputBase = positionalArgs[1];

// Parse AR flag, default to 1:1 if not set
const arFlag = flags.find(f => f.startsWith('--ar=')) || "--ar=1:1";
const aspectRatio = arFlag.split('=')[1];

if (!inputTopic || !outputBase) {
    console.error('Usage: node gen_google_images.js "Topic" "OutputBaseName" --ar=16:9');
    process.exit(1);
}

// Helper: Ensure directory exists
function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
    console.log(`\n--- Starting Board Generation for: "${inputTopic}" ---`);
    console.log(`--- Aspect Ratio: ${aspectRatio} ---`);

    // ---------------------------------------------------------
    // STEP 1: Story & Prompt Generation (Gemini 3 Flash Preview)
    // ---------------------------------------------------------
    console.log("1. Generating Story & Prompts with gemini-3-flash-preview...");

    // We want a JSON output with the story and list of prompts
    const planningPrompt = `
    You are a creative director. Create a short, engaging story based on the topic: "${inputTopic}".
    Break this story down into 4 distinct visual scenes (panels).
    For each scene, write a highly detailed image generation prompt.
    
    Output strictly valid JSON in this format:
    {
        "story": "The full story text...",
        "panels": [
            { "id": 1, "prompt": "Detailed prompt for panel 1..." },
            { "id": 2, "prompt": "Detailed prompt for panel 2..." },
            { "id": 3, "prompt": "Detailed prompt for panel 3..." },
            { "id": 4, "prompt": "Detailed prompt for panel 4..." }
        ]
    }
    `;

    let storyData;
    try {
        const textResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: planningPrompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const rawText = textResponse.text;
        storyData = JSON.parse(rawText);
        console.log("   > Story generated.");
        console.log("   > Prompts created:", storyData.panels.length);

    } catch (e) {
        console.error("Failed to generate story/prompts:", e);
        process.exit(1);
    }

    // ---------------------------------------------------------
    // STEP 2: Image Generation Loop
    // ---------------------------------------------------------
    console.log("\n2. Generating Images...");

    let previousImageBuffer = null;

    for (let i = 0; i < storyData.panels.length; i++) {
        const panel = storyData.panels[i];
        const isFirst = i === 0;
        const filename = outputBase.endsWith('.png')
            ? outputBase.replace('.png', `_${panel.id}.png`)
            : `${outputBase}_${panel.id}.png`;

        ensureDir(filename);

        console.log(`   > Generating Panel ${panel.id} (${isFirst ? 'Base' : 'Refined'})...`);

        try {
            let buffer;

            // Common Image Config
            const imageConfig = {
                aspectRatio: aspectRatio
            };

            if (isFirst) {
                // --- FIRST IMAGE: Gemini 2.5 Flash Image ---
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash-image",
                    contents: panel.prompt,
                    config: {
                        // Apply AR via config if supported (implied yes for GenAI SDK image models)
                        // Note: SDK structure might differ slightly but imageConfig is standardizing
                        // If 2.5 Flash uses 'sampleCount' legacy style, the SDK usually handles mapping or we pass parameters.
                        // For now assuming unified imageConfig works as per user request.
                        responseModalities: ["IMAGE"],
                        imageConfig: imageConfig
                    }
                });

                const candidate = response.candidates?.[0];
                if (!candidate) throw new Error("No candidates received");

                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        buffer = Buffer.from(part.inlineData.data, "base64");
                        break;
                    }
                }

                if (!buffer) throw new Error("No image data found in response");

            } else {
                // --- SUBSEQUENT IMAGES: Gemini 3 Pro Image Preview (with Reference) ---
                console.log("     Using gemini-3-pro-image-preview (generateContent)...");

                const messageParts = [
                    { text: `Generate an image for this scene: ${panel.prompt}. Maintain the style and consistency of the previous image provided.` }
                ];

                if (previousImageBuffer) {
                    messageParts.push({
                        inlineData: {
                            mimeType: "image/png",
                            data: previousImageBuffer.toString("base64")
                        }
                    });
                }

                const response = await ai.models.generateContent({
                    model: "gemini-3-pro-image-preview",
                    contents: [
                        {
                            role: "user",
                            parts: messageParts
                        }
                    ],
                    config: {
                        responseModalities: ["TEXT", "IMAGE"],
                        imageConfig: imageConfig
                    }
                });

                const candidate = response.candidates?.[0];
                if (!candidate) throw new Error("No candidates received");

                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        buffer = Buffer.from(part.inlineData.data, "base64");
                        break;
                    }
                }
                if (!buffer) throw new Error("No image data found in response");
            }

            // Save Image
            fs.writeFileSync(filename, buffer);
            console.log(`     Saved: ${filename}`);

            // Update reference for next iteration (Linear Consistency)
            previousImageBuffer = buffer;

        } catch (err) {
            console.error(`     Failed to generate Panel ${panel.id}:`, err.message);
        }
    }

    console.log("\n--- Generation Complete ---");
}

main();
