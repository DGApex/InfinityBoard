import { readTextFile, BaseDirectory } from '@tauri-apps/api/fs';

// Helper to get API Key
const getApiKey = async () => {
    // 1. Check LocalStorage ( User Settings )
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) return storedKey;

    try {
        // 2. Fallback: Check local .env in the same directory (relative)
        const envPath = 'C:\\Users\\Usuario\\Documents\\Apps\\InfinityBoard\\Skills\\board-generator\\scripts\\.env';
        const contents = await readTextFile(envPath);
        const match = contents.match(/GOOGLE_API_KEY=(.*)/);
        if (match && match[1]) {
            console.log("API Key loaded from .env");
            return match[1].trim();
        }
    } catch (e) {
        console.warn("Could not read API Key from .env file:", e);
    }
    return null;
};

/**
 * Generic helper to call Gemini Text Models (Gemini 3 Flash Preview)
 */
const callGeminiText = async (userId, systemInstruction, userPrompt, apiKey) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    const parts = [{ text: userPrompt }];

    const requestBody = {
        contents: [{ parts }],
        system_instruction: {
            parts: [{ text: systemInstruction }]
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Gemini Text Error: ${txt}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

/**
 * Uses Gemini 3 Flash Preview to enhance a prompt
 */
export const enhancePrompt = async (currentPrompt) => {
    const apiKey = await getApiKey();
    if (!apiKey) throw new Error("API Key missing");

    const systemPrompt = "You are an expert Prompt Engineer for AI Image Generators. Rewrite the user's prompt to be more descriptive, artistic, and detailed. Focus on lighting, texture, mood, and composition. Keep it under 40 words. Output ONLY the optimized prompt.";

    try {
        const enhanced = await callGeminiText("user", systemPrompt, currentPrompt, apiKey);
        return enhanced.trim();
    } catch (e) {
        console.error("Enhance failed:", e);
        return currentPrompt; // Fallback
    }
};

/**
 * Generates an image using Gemini Models (2.5 Flash Image OR 3 Pro Image Preview)
 */
export const generatePanelImage = async (prompt, referenceBase64 = null, aspectRatio = "1:1") => {
    console.log(`Starting Generation. Prompt: "${prompt}", AR: ${aspectRatio}`);

    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error("API Key not found in Skills/board-generator/scripts/.env");
    }

    let modelName = 'gemini-2.5-flash-image';
    let payloadContents = [];

    // Base/Default Config
    // Use TEXT, IMAGE for robust multimodel support as per user snippet
    let generationConfig = {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
            aspectRatio: aspectRatio
        }
    };

    if (referenceBase64) {
        // WITH REFERENCE: Use Gemini 3 Pro Image Preview
        modelName = 'gemini-3-pro-image-preview';
        console.log("Using Gemini 3 Pro Image Preview (Reference Mode)");

        const mimeMatch = referenceBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
        const cleanBase64 = referenceBase64.replace(/^data:image\/\w+;base64,/, "");

        payloadContents = [{
            parts: [
                { text: `Generate an image based on this prompt: ${prompt}. Maintain the style of the provided reference image.` },
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: cleanBase64
                    }
                }
            ]
        }];

        // Config already set, but confirm it applies here

    } else {
        // NO REFERENCE: Use Gemini 2.5 Flash Image
        console.log("Using Gemini 2.5 Flash Image (Base Mode)");
        payloadContents = [{
            parts: [{ text: prompt }]
        }];

        // Base mode also uses the same generationConfig with AR
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: payloadContents,
        generationConfig: generationConfig
    };

    try {
        console.log("Sending Request Body:", JSON.stringify(requestBody));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini Image API Error (${response.status}): ${err}`);
        }

        const data = await response.json();

        // Parse Gemini Response for Image
        // Robust checking for inlineData (CamelCase) or inline_data (SnakeCase)
        const parts = data.candidates?.[0]?.content?.parts;
        if (!parts) throw new Error("No content parts in response");

        let base64Data = null;
        for (const part of parts) {
            // Check CamelCase (REST) first, then SnakeCase
            if (part.inlineData && part.inlineData.data) {
                base64Data = part.inlineData.data;
                break;
            }
            if (part.inline_data && part.inline_data.data) {
                base64Data = part.inline_data.data;
                break;
            }
        }

        if (!base64Data) {
            console.warn("Full Response:", JSON.stringify(data));
            throw new Error("No image data found in generation response.");
        }

        return base64Data;

    } catch (error) {
        console.error("Panel generation failed:", error);
        throw error;
    }
};
