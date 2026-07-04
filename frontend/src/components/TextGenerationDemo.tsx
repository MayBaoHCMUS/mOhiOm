"use client";

import { useState } from "react";
import { geminiApi } from "@/services/api";

export default function TextGenerationDemo() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"stream" | "no-stream">("stream");

  const handleStreamGeneration = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsStreaming(true);
    setIsLoading(true);
    setResponse("");
    setError("");

    await geminiApi.generateTextStream(
      prompt,
      (chunk) => {
        setResponse((prev) => prev + chunk);
      },
      () => {
        setIsStreaming(false);
        setIsLoading(false);
      },
      (errorMsg) => {
        setError(errorMsg);
        setIsStreaming(false);
        setIsLoading(false);
      }
    );
  };

  const handleNoStreamGeneration = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsLoading(true);
    setResponse("");
    setError("");

    try {
      const result = await geminiApi.generateText(prompt, false);
      setResponse(result.data.generated_text);
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || err.message || "Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => {
    if (mode === "stream") {
      handleStreamGeneration();
    } else {
      handleNoStreamGeneration();
    }
  };

  const handleClear = () => {
    setPrompt("");
    setResponse("");
    setError("");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Text Generation Demo</h2>


        <div className="mb-4">
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
            Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            disabled={isLoading}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Generating..." : "Generate"}
          </button>
          <button
            onClick={handleClear}
            disabled={isLoading}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {response && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Response</label>
              {isStreaming && (
                <span className="text-sm text-blue-600 flex items-center">
                  <span className="animate-pulse mr-2">●</span>
                  Streaming...
                </span>
              )}
            </div>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md whitespace-pre-wrap">
              {response}
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            <strong>Stream Mode:</strong> Responses appear in real-time as they are generated, providing
            immediate feedback.
          </li>
          <li>
            <strong>No Stream Mode:</strong> Waits for the complete response before displaying it all at
            once.
          </li>
        </ul>
      </div>
    </div>
  );
}
