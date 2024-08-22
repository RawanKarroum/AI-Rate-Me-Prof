import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import puppeteer from 'puppeteer';
import { Document } from "@langchain/core/documents";
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

// Function to chunk text into approximately 2000 character segments
const chunkText = (text: string, chunkSize: number): string[] => {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
};

// Function to load documents from the web and extract comments
const loadDocumentsFromWeb = async (url: string): Promise<{ docs: Document[], analyzedComments: any[] }> => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  // Extract the page content as plain text
  const content = await page.evaluate(() => document.body.innerText); 

  // Use the correct selector based on the page structure
  const comments = await page.evaluate(() => {
    const commentElements = Array.from(document.querySelectorAll('.Comments__StyledComments-dzzyvm-0')); 
    return commentElements.map(el => el.textContent ? el.textContent.trim() : '');
  });

  // Log the extracted comments as a JSON array
  console.log("Extracted comments:", JSON.stringify(comments, null, 2));

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

  // Log analyzed comments
  console.log("Analyzed Comments:", JSON.stringify(analyzedComments, null, 2));

  await browser.close();

  // Split content into chunks of approximately 2000 characters each
  const chunkSize = 2000; 
  const chunks = chunkText(content, chunkSize);

  // Create Document objects from chunks
  const docs = chunks.map((chunk, index) => new Document({
    pageContent: chunk,
    metadata: { url, chunkIndex: index },
  }));

  return { docs, analyzedComments };
};

const setupPineconeLangchain = async (urls: string[]): Promise<{ vectorStore: PineconeStore, analyzedComments: any[] }> => {
  let allDocs: Document[] = [];
  let allAnalyzedComments: any[] = [];

  for (const url of urls) {
    const { docs, analyzedComments } = await loadDocumentsFromWeb(url);
    allDocs = allDocs.concat(docs);
    allAnalyzedComments = allAnalyzedComments.concat(analyzedComments);
  }
  
  // console.log("Documents loaded:", allDocs);

  // Initialize Pinecone
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY as string,
  });
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX as string);
  console.log("Pinecone index initialized");

  // Initialize embeddings
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY as string,
  });
  console.log("Embeddings instance created");

  // Create vector store from all documents
  const vectorStore = await PineconeStore.fromDocuments(allDocs, embeddings, {
    pineconeIndex: pineconeIndex,
  });
  console.log("Vector store created");

  return { vectorStore, analyzedComments: allAnalyzedComments }; 
};

export const POST = async (req: NextRequest) => {
  try {
    console.log("Received request to process URL");

    const { url } = await req.json(); // Extract the URL from the request body

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    const { vectorStore, analyzedComments } = await setupPineconeLangchain([url]); 
    console.log("Pinecone and LangChain setup complete, documents inserted into vector store");

    return NextResponse.json({ 
      message: "Document successfully inserted into vector store",
      analyzedComments, 
    });
  } catch (error) {
    console.error("Error processing URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
};

export const OPTIONS = async () => {
  return NextResponse.json({}, { status: 200 });
};
