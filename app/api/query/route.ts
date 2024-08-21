import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { ChatOpenAI } from "@langchain/openai";
import { SelfQueryRetriever } from "langchain/retrievers/self_query";
import { PineconeTranslator } from "@langchain/pinecone";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from 'uuid'; // Use uuid to create unique session IDs
import { prompt } from '../../utils/Prompt';

interface ChatHistory {
  [key: string]: Array<HumanMessage | AIMessage | SystemMessage>;
}

const chatHistories: ChatHistory = {}; // Store chat history per session

const setupPineconeLangchain = async () => {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY as string,
  });
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX as string);

  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY as string,
  });

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
  });

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.0,
    apiKey: process.env.OPENAI_API_KEY as string,
  });

  const selfQueryRetriever = SelfQueryRetriever.fromLLM({
    llm: llm,
    vectorStore: vectorStore,
    documentContents: "Document content",
    attributeInfo: [],
    structuredQueryTranslator: new PineconeTranslator(),
  });

  return { selfQueryRetriever, llm };
};

export const POST = async (req: NextRequest) => {
  try {
    const { question, sessionId } = await req.json();

    if (!question) {
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }

    // Log the incoming session ID for debugging
    console.log("Incoming session ID:", sessionId);

    // Create a new session if sessionId is not provided
    let session = sessionId || uuidv4();

    // Log the session ID being used
    console.log("Using session ID:", session);

    const { selfQueryRetriever, llm } = await setupPineconeLangchain();

    // Initialize chat history for the session if it doesn't exist
    if (!chatHistories[session]) {
      console.log("Initializing new chat history for session:", session);
      chatHistories[session] = [];
    } else {
      console.log("Appending to existing chat history for session:", session);
    }

    // Fetch relevant documents based on the user's query
    const relevantDocuments = await selfQueryRetriever.invoke(question);
    const documentContents = relevantDocuments.map(doc => doc.pageContent).join("\n");

    // Append current question to chat history
    chatHistories[session].push(new HumanMessage(question));

    // Prepare the current set of messages including the previous history
    const messages = [
      new SystemMessage(prompt),
      ...chatHistories[session], // Include previous history
      new AIMessage(documentContents),
    ];

    // Generate a response based on the retrieved documents and chat history
    const response = await llm.invoke(messages);
    const answerContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    // Append assistant's response to chat history
    chatHistories[session].push(new AIMessage(answerContent));

    // Return the assistant's response and the session ID
    return NextResponse.json({ response: answerContent, sessionId: session });
  } catch (error) {
    console.error("Error processing query:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
};

export const OPTIONS = async () => {
  return NextResponse.json({}, { status: 200 });
};

// New function to clear chat history based on session ID
export const DELETE = async (req: NextRequest) => {
  try {
    const { sessionId } = await req.json();

    if (sessionId && chatHistories[sessionId]) {
      console.log("Clearing chat history for session:", sessionId);
      delete chatHistories[sessionId]; // Clear chat history for this session
    } else {
      console.log("No chat history found for session:", sessionId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing chat history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
};
