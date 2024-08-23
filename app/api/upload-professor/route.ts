import { NextRequest, NextResponse } from 'next/server';
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { db } from '../../config/Firebase';  // Import Firebase Firestore
import { collection, addDoc } from "firebase/firestore"; 
import OpenAI from "openai";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to classify sentiment
async function classifySentiment(review: string): Promise<string | null> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Please classify the sentiment of the following review as Positive, Negative, or Neutral: "${review}", Do not return any other output other than Positive, Negative, or Neutral. `,
      },
    ],
    temperature: 0.7,
    max_tokens: 10,
  });

  const choice = response?.choices?.[0]?.message?.content;
  return choice ? choice.trim() : null;
}

// Function to load documents from the web and extract comments and professor's name
const loadDocumentsFromWeb = async (url: string): Promise<{ analyzedComments: any[], professorName: string | null }> => {
  let browser = null;
  let result = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Extract the page content as plain text
    const content = await page.evaluate(() => document.body.innerText);

    // Extract the professor's name
    const professorName = await page.evaluate(() => {
      const nameElement = document.querySelector('.NameTitle__Name-dowf0z-0.cfjPUG');
      return nameElement && nameElement.textContent ? nameElement.textContent.trim() : null;
    });

    // Use the correct selector based on the page structure
    const comments = await page.evaluate(() => {
      const commentElements = Array.from(document.querySelectorAll('.Comments__StyledComments-dzzyvm-0'));
      return commentElements.map(el => el.textContent ? el.textContent.trim() : '');
    });

    // Perform sentiment analysis on extracted comments
    const analyzedComments = await Promise.all(
      comments.map(async (comment) => {
        const sentiment = await classifySentiment(comment);
        return {
          comment,
          sentiment,
          date: new Date().toISOString(),
        };
      })
    );

    // Upload analyzed comments to Firestore under the professor's name
    if (professorName) {
      const docRef = await addDoc(collection(db, "professor_comments"), {
        professorName,
        analyzedComments,
        url,
        timestamp: new Date().toISOString(),
      });
      console.log("Document written with ID: ", docRef.id);
    }

    // Return the documents, analyzed comments, and professor's name
    result = { analyzedComments, professorName };

  } catch (error) {
    console.error("Error loading documents from web:", error);
    throw new Error("Failed to load documents");
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  return result;
};

// POST handler to process URL and return professor's name and analyzed comments
export const POST = async (req: NextRequest) => {
  try {
    const { url } = await req.json(); // Extract the URL from the request body

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    const { analyzedComments, professorName } = await loadDocumentsFromWeb(url);

    return NextResponse.json({
      message: "Document successfully processed",
      analyzedComments,
      professorName,
    });
  } catch (error) {
    console.error("Error processing URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
};

export const OPTIONS = async () => {
  return NextResponse.json({}, { status: 200 });
};
