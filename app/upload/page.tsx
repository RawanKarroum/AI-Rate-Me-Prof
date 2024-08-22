'use client';

import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import Dashboard from '../dashboard/page'; 

const UploadProfessorURL = () => {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [analyzedComments, setAnalyzedComments] = useState([]);

  const handleUpload = async () => {
    setMessage("");
  
    if (!url) {
      setMessage("Please enter a URL.");
      return;
    }
  
    try {
      const response = await fetch("/api/upload-professor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
  
      if (response.ok) {
        const data = await response.json();
        setAnalyzedComments(data.analyzedComments || []); 
        setMessage("Professor data successfully uploaded.");
      } else {
        const data = await response.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error uploading professor data:", error);
      setMessage("Error uploading professor data.");
    }
  };  

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '600px',
        margin: 'auto',
        padding: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Typography variant="h4" gutterBottom>
        Upload Professor URL
      </Typography>
      <TextField
        label="Professor URL"
        variant="outlined"
        fullWidth
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        sx={{ marginBottom: 2 }}
      />
      <Button variant="contained" onClick={handleUpload}>
        Upload
      </Button>
      {message && (
        <Typography variant="body1" color="error" sx={{ marginTop: 2 }}>
          {message}
        </Typography>
      )}
      <Dashboard analyzedComments={analyzedComments} />
    </Box>
  );
};

export default UploadProfessorURL;
