import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { ChatOpenAI } from "@langchain/openai";
import { SelfQueryRetriever } from "langchain/retrievers/self_query";
import { PineconeTranslator } from "@langchain/pinecone";
import puppeteer from 'puppeteer';
import { Document } from "@langchain/core/documents";

// Array of URLs to process
const urls = [
    "https://www.torontomu.ca/",
    "https://www.torontomu.ca/programs/undergraduate/computer-engineering/",
    "https://www.torontomu.ca/admissions/undergraduate/apply/",
    "https://www.torontomu.ca/programs/undergraduate/computer-engineering/#tab-1691528434193-tuition-and-fees",
    "https://www.torontomu.ca/calendar/2024-2025/programs/feas/computer_eng/#!accordion-1595938884546-full-time--four-year-program---software-engineering-option",
    "https://www.torontomu.ca/calendar/2024-2025/programs/feas/computer_eng/#!accordion-1595938884507-computer-engineering---common-first-two-years",
    "https://www.torontomu.ca/calendar/2024-2025/dates/",
    "https://www.torontomu.ca/programs/undergraduate/computer-science/",
    "https://www.torontomu.ca/programs/undergraduate/computer-science/#!accordion-1694188206521-requirements-for-full-time--4-year-program",
    "https://www.torontomu.ca/calendar/2024-2025/programs/science/computer_sci/#!accordion-1595938857886-full-time--four-year-program",
    "https://www.torontomu.ca/programs/undergraduate/computer-science/#tab-1693260955526-tuition-and-fees",
];

// Function to chunk text into approximately 2000 character segments
const chunkText = (text: string, chunkSize: number): string[] => {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
};

// Function to load documents from the web
const loadDocumentsFromWeb = async (url: string): Promise<Document[]> => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const content = await page.evaluate(() => document.body.innerText); // Fetch the page content as plain text
  await browser.close();

  // Split content into chunks of approximately 2000 characters each
  const chunkSize = 2000; // Adjust based on average token size
  const chunks = chunkText(content, chunkSize);

  // Create Document objects from chunks
  const docs = chunks.map((chunk, index) => new Document({
    pageContent: chunk,
    metadata: { url, chunkIndex: index },
  }));

  return docs;
};

const setupPineconeLangchain = async () => {
  // Load documents from all URLs
  let allDocs: Document[] = [];
  for (const url of urls) {
    const docs = await loadDocumentsFromWeb(url);
    allDocs = allDocs.concat(docs);
  }
  console.log("Documents loaded:", allDocs);

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

  // Initialize LLM
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.8,
    apiKey: process.env.OPENAI_API_KEY as string,
  });
  console.log("LLM instance created");

  // Initialize SelfQueryRetriever
  const selfQueryRetriever = SelfQueryRetriever.fromLLM({
    llm: llm,
    vectorStore: vectorStore,
    documentContents: "Document content",
    attributeInfo: [],
    structuredQueryTranslator: new PineconeTranslator(),
  });
  console.log("SelfQueryRetriever instance created");

  return { selfQueryRetriever, llm };
};

export const POST = async (req: NextRequest) => {
  try {
    console.log("Received request");
    const { question } = await req.json();
    console.log("Question received:", question);

    if (!question) {
      console.log("No question provided");
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }

    const { selfQueryRetriever, llm } = await setupPineconeLangchain();
    console.log("Pinecone and LangChain setup complete");

    // Retrieve relevant documents
    const relevantDocuments = await selfQueryRetriever.invoke(question);
    console.log("Relevant documents retrieved:", relevantDocuments);

    const documentContents = relevantDocuments.map(doc => doc.pageContent).join("\n");
    console.log("Document contents:", documentContents);

    // Prepare messages for the LLM
    const messages = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: question },
      { role: "system", content: documentContents },
    ];
    console.log("Messages prepared for LLM:", messages);

    // Generate a response based on the retrieved documents
    const response = await llm.invoke(messages as any);
    console.log("Response generated:", response);

    const answer = response.content;
    console.log("Generated response content:", answer);

    return NextResponse.json({ response: answer });
  } catch (error) {
    console.error("Error processing query:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
};

export const OPTIONS = async () => {
  return NextResponse.json({}, { status: 200 });
};
