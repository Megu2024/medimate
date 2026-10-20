import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Settings } from '../models/Settings.js';
import { decrypt } from '../utils/encryption.js';
import { config } from '../config/env.js';

/**
 * Resolves the active Gemini API key for a caregiver
 * Checks User's private encrypted key in Settings first, then falls back to server env GEMINI_API_KEY
 */
export async function getActiveGeminiApiKey(userId) {
  if (userId) {
    const userSettings = await Settings.findOne({ userId }).select('+encryptedGeminiKey');
    if (userSettings && userSettings.encryptedGeminiKey) {
      try {
        const decryptedKey = decrypt(userSettings.encryptedGeminiKey);
        if (decryptedKey) return decryptedKey;
      } catch (err) {
        console.error('[GeminiService] Failed to decrypt user Gemini key:', err.message);
      }
    }
  }

  // Fall back to server environment variable if configured
  if (config.geminiApiKey) {
    return config.geminiApiKey;
  }

  return null;
}

/**
 * Extract text from uploaded PDF or format image for Gemini Multimodal API
 */
async function extractContentForGemini(filePath, mimeType) {
  if (mimeType === 'application/pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    return {
      type: 'text',
      content: pdfData.text || 'No readable text extracted from PDF.'
    };
  } else if (mimeType.startsWith('image/')) {
    const imageBytes = fs.readFileSync(filePath);
    return {
      type: 'image',
      inlineData: {
        data: imageBytes.toString('base64'),
        mimeType
      }
    };
  }
  throw new Error(`Unsupported file type for analysis: ${mimeType}`);
}

/**
 * Analyze medical report with Google Gemini in requested language
 */
export async function analyzeMedicalReport({ filePath, mimeType, language = 'English', userId }) {
  const apiKey = await getActiveGeminiApiKey(userId);

  if (!apiKey) {
    throw new Error(
      'Gemini API key is not configured. Please add your Google Gemini API key in Settings -> AI Configuration to enable medical report analysis.'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Using gemini-1.5-flash for rapid, accurate multimodal clinical document understanding
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

  const extracted = await extractContentForGemini(filePath, mimeType);

  const systemPrompt = `You are a compassionate, expert healthcare communication assistant helping an elderly person's caregiver understand a medical laboratory or diagnostic report.
Target Language for your response: ${language}.

IMPORTANT CLINICAL AND ETHICAL CONSTRAINTS:
1. Explain all findings in simple, easy-to-understand layman's language.
2. Use ONLY the information provided in the report and general reliable medical facts. Do NOT invent missing lab values, diagnoses, or history.
3. Distinguish clearly between reference ranges printed on the report and general medical expectations.
4. Do NOT definitively diagnose a disease, recommend altering prescribed dosages, or tell the patient to discontinue medications.
5. If abnormal or critical values suggest urgency, clearly recommend prompt consultation with a doctor.

Please structure your response strictly as a JSON object with the following exact keys (in ${language}):
{
  "summary": "Concise high-level summary of the report and its primary focus",
  "testsExplanation": "Clear explanation of each major test performed and why it was measured",
  "abnormalFindings": "Specific results outside the reference ranges stated in the report, or clearly indicate 'None' if all are within normal limits",
  "plainLanguageMeaning": "What these findings may indicate in ordinary non-medical language",
  "doctorQuestions": ["List of 3-5 clear, practical questions the caregiver or patient can ask their doctor at their next visit"],
  "limitationsAndUrgency": "Important limitations of this AI explanation, noting that this is informational and not a diagnosis, plus guidance on whether urgent medical evaluation is indicated"
}
Ensure the response is strictly valid JSON with no extraneous markdown outside the json block.`;

  let responseText = '';

  try {
    if (extracted.type === 'text') {
      const result = await model.generateContent([
        systemPrompt,
        `Document Extracted Text:\n${extracted.content}`
      ]);
      responseText = result.response.text();
    } else {
      const result = await model.generateContent([
        systemPrompt,
        'Please analyze this attached diagnostic report image:',
        extracted.inlineData
      ]);
      responseText = result.response.text();
    }

    // Clean JSON response
    const cleanJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    return {
      success: true,
      data: parsed,
      modelUsed: 'gemini-3.5-flash'
    };
  } catch (error) {
    console.error('[Gemini Analysis Error]:', error);
    if (error.message.includes('API_KEY_INVALID') || error.message.includes('403')) {
      throw new Error('Configured Gemini API key is invalid or lacks permissions. Please check your key in Settings.');
    }
    throw new Error(`Failed to analyze medical report: ${error.message}`);
  }
}
