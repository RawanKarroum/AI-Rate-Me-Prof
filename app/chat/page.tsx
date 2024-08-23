"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  TextField,
  Button,
  List,
  ListItemText,
  Typography,
  ListItem,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ReactMarkdown from "react-markdown";
import { Line } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

// Define types for chat history entries
type ChatMessage = {
  user: string;
  bot: string;
};

type TrendMessage = ChatMessage & {
  trendData?: any;
};

const ChatPage = () => {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<TrendMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedSessionId = localStorage.getItem("sessionId");
      setSessionId(storedSessionId);
    }
  }, []);

  const handleSendMessage = async () => {
    if (!message) return;

    const userMessage: ChatMessage = { user: message, bot: "" };
    setChatHistory([...chatHistory, userMessage]);
    setMessage("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: message, sessionId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botMessageContent = data.response;
      const botMessage: ChatMessage = { user: message, bot: botMessageContent };

      setChatHistory((prevChat) => [...prevChat, botMessage]);
      setIsTyping(false);

      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem("sessionId", data.sessionId);
      }

      if (data.ratings && data.ratings.length > 0) {
        const ratingsArray = data.ratings[0];

        const labels = ratingsArray.map((_: any, index: any) => index + 1);
        const values = ratingsArray.map((entry: any) => {
          const sentiment = entry.sentiment?.toLowerCase();
          if (sentiment === "positive") return 1;
          if (sentiment === "neutral") return 0;
          if (sentiment === "negative") return -1;
          return null;
        });

        const trendData = {
          labels: labels,
          datasets: [
            {
              label: "Professor Ratings Over Time",
              data: values,
              fill: false,
              backgroundColor: "rgba(75,192,192,1)",
              borderColor: "rgba(75,192,192,1)",
              borderWidth: 2,
              tension: 0.1,
            },
          ],
        };

        const trendBubble: TrendMessage = {
          user: "",
          bot: "Here is the trend line of ratings over time:",
          trendData: trendData, // Adding the trend data to the chat history
        };

        setChatHistory((prevChat) => [...prevChat, trendBubble]);
      }

      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop =
          chatContainerRef.current.scrollHeight;
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setIsTyping(false);
    }
  };

  useEffect(() => {
    let typingInterval: NodeJS.Timeout;
    if (isTyping) {
      typingInterval = setInterval(() => {
        setTypingIndicator((prev) => (prev === "..." ? "" : prev + "."));
      }, 500);
    }

    return () => clearInterval(typingInterval);
  }, [isTyping]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem("sessionId");
      setSessionId(null);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "700px",
        backgroundColor: "white",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        borderRadius: "15px",
        display: "flex",
        flexDirection: "column",
        padding: 3,
        flexGrow: 0,
        height: "calc(100% - 190px)",
        boxSizing: "border-box",
      }}
    >
      <Typography
        variant="h4"
        align="center"
        gutterBottom
        sx={{ fontWeight: "bold", color: "#333" }}
      >
        TMU Support Assistant
      </Typography>
      <Box
        ref={chatContainerRef}
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          padding: 2,
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          boxShadow: "inset 0 0 10px rgba(0, 0, 0, 0.1)",
          minHeight: "auto",
        }}
      >
        <List sx={{ flexGrow: 1 }}>
          {chatHistory.map((chatItem, index) => (
            <ListItem
              key={index}
              sx={{
                display: "flex",
                justifyContent: chatItem.bot ? "flex-start" : "flex-end",
              }}
            >
              <Box
                component="div"
                sx={{
                  backgroundColor: chatItem.bot ? "#fcf07e" : "#007bff",
                  color: chatItem.bot ? "#333" : "#fff",
                  borderRadius: "15px",
                  padding: "10px 20px",
                  maxWidth: "60%",
                  textAlign: "left",
                  wordBreak: "break-word",
                  boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)",
                  transition: "transform 0.2s ease",
                  "&:hover": {
                    transform: "scale(1.02)",
                  },
                }}
              >
                {chatItem.bot ? (
                  chatItem.trendData ? (
                    <>
                      <Typography variant="body2">
                        {chatItem.bot}
                      </Typography>
                      <Box sx={{ width: "100%", maxHeight: "300px", marginTop: 2 }}>
                        <Line data={chatItem.trendData} />
                      </Box>
                    </>
                  ) : (
                    <ReactMarkdown>{chatItem.bot}</ReactMarkdown>
                  )
                ) : (
                  <ListItemText primary={chatItem.user} />
                )}
              </Box>
            </ListItem>
          ))}
          {isTyping && (
            <ListItem sx={{ display: "flex", justifyContent: "flex-start" }}>
              <Box
                component="div"
                sx={{
                  backgroundColor: "#fcf07e",
                  borderRadius: "15px",
                  padding: "10px 20px",
                  maxWidth: "60%",
                  textAlign: "left",
                  wordBreak: "break-word",
                  boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ListItemText primary={typingIndicator || "..."} />
              </Box>
            </ListItem>
          )}
        </List>
      </Box>
      <Box
        sx={{
          display: "flex",
          marginTop: 2,
          padding: "0 8px",
          alignItems: "center",
          width: "100%",
        }}
      >
        <TextField
          label="Type your message"
          variant="outlined"
          fullWidth
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") handleSendMessage();
          }}
          sx={{
            marginRight: "12px",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
          }}
        />
        <Button
          variant="contained"
          sx={{
            marginRight: "16px",
            backgroundColor: "#007bff",
            color: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            "&:hover": {
              backgroundColor: "#0056a3",
            },
            padding: "10px 16px",
            minWidth: "75px",
          }}
          onClick={handleSendMessage}
          endIcon={<SendIcon />}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
};

export default ChatPage;
