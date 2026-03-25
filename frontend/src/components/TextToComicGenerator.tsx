'use client';

import React, { useState } from 'react';

interface Step1Result {
  totalCharacters: number;
  plotAnalysis: string;
  chapterDivision: string[];
  sceneBreakdown: string;
}

interface Character {
  name: string;
  description: string;
  imagePrompt: string;
}

interface Step2Result {
  globalGuidelines: string;
  mainCharacters: Character[];
  aiPrompts: string[];
}

interface PanelScript {
  pageNumber: number;
  layoutSummary: string;
  panels: {
    panelNumber: number;
    description: string;
    dialogue: string;
    imagePrompt: string;
  }[];
}

interface Step3Result {
  totalPages: number;
  scripts: PanelScript[];
}

interface Step4Result {
  images: {
    id: string;
    pageNumber: number;
    panelNumber: number;
    prompt: string;
    imageUrl: string;
  }[];
}

export default function TextToComicGenerator() {
  // Input and Configuration State
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyText, setStoryText] = useState('');
  const [mainCharacters, setMainCharacters] = useState('5');
  const [numChapters, setNumChapters] = useState('3');
  const [targetPages, setTargetPages] = useState('50');
  const [mangaGenre, setMangaGenre] = useState('Adventure, Fantasy');
  const [artStyle, setArtStyle] = useState('Anime, detailed linework');
  const [maxPanelsPerPage, setMaxPanelsPerPage] = useState('6');

  // Step Results State
  const [step1Result, setStep1Result] = useState<Step1Result | null>(null);
  const [step2Result, setStep2Result] = useState<Step2Result | null>(null);
  const [step3Result, setStep3Result] = useState<Step3Result | null>(null);
  const [step4Result, setStep4Result] = useState<Step4Result | null>(null);

  // Loading States
  const [loadingStep, setLoadingStep] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState(1);

  // Mock async handlers
  const handleStep1 = async () => {
    setLoadingStep(1);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockStep1: Step1Result = {
      totalCharacters: parseInt(mainCharacters),
      plotAnalysis: `
# Plot & Arc Analysis

## Main Plot Arc
The story follows a classic hero's journey with the protagonist facing three major challenges:
1. **Inciting Incident**: The discovery of a hidden world
2. **Climax**: The final confrontation with the antagonist
3. **Resolution**: The restoration of balance

## Character Development
Each main character undergoes significant development:
- Character 1: From doubt to confidence
- Character 2: From isolation to connection
- Character 3: From ambition to wisdom
      `,
      chapterDivision: [
        'Chapter 1: The Beginning - Pages 1-8',
        'Chapter 2: Rising Action - Pages 9-20',
        'Chapter 3: The Twist - Pages 21-35',
        'Chapter 4: Climax - Pages 36-45',
        'Chapter 5: Resolution - Pages 46-50',
      ],
      sceneBreakdown: `
## Scene-by-Scene Breakdown

**Scene 1 (Pages 1-3)**: Introduction of protagonist in their daily life
**Scene 2 (Pages 4-6)**: First encounter with the mysterious force
**Scene 3 (Pages 7-10)**: Discovery and decision to embark on journey
**Scene 4 (Pages 11-15)**: Meeting the first ally
**Scene 5 (Pages 16-20)**: First major challenge
... (and more scenes continue)
      `,
    };

    setStep1Result(mockStep1);
    setLoadingStep(null);
    setActiveStep(2);
  };

  const handleStep2 = async () => {
    setLoadingStep(2);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockStep2: Step2Result = {
      globalGuidelines: `
# Global Design Guidelines

## Art Style
${artStyle}

## Color Palette
- Primary: Deep blues and purples for mystical elements
- Secondary: Earth tones for grounding
- Accents: Bright colors for action scenes

## Tone & Mood
${mangaGenre}

## Panel Style
Clean linework with dynamic layouts emphasizing movement and emotion
      `,
      mainCharacters: [
        {
          name: 'Protagonist - Aura',
          description:
            'A young hero discovering their hidden powers. 16-18 years old, determined expression, athletic build.',
          imagePrompt:
            'anime character, young hero girl, purple eyes, determined expression, magical aura around her, intricate details, highly detailed face',
        },
        {
          name: 'Mentor - Elder Sage',
          description:
            'Wise mentor figure with centuries of knowledge. Calm, mysterious, carries ancient artifacts.',
          imagePrompt:
            'anime old wise man, long white beard, glowing eyes, ancient robes, holding magical staff, mystical aura, detailed linework',
        },
        {
          name: 'Rival - Shadow',
          description:
            'Conflicted antagonist with hidden motives. Dark clothing, mysterious background.',
          imagePrompt:
            'anime antagonist, dark hair, mysterious smile, black clothing, shadow magic surrounding, intense eyes, dramatic pose',
        },
        {
          name: 'Companion - Lyra',
          description:
            'Loyal friend with quirky personality. Brings humor and heart to the story.',
          imagePrompt:
            'anime girl character, playful expression, colorful hair, casual clothing, warm smile, dynamic pose, expressive eyes',
        },
        {
          name: 'Villain - Dark Lord',
          description:
            'Powerful antagonist seeking to control the world. Imposing presence, commanding aura.',
          imagePrompt:
            'anime villain, dark lord, imposing figure, glowing eyes, dark armor, shadow magic, evil aura, highly detailed',
        },
      ],
      aiPrompts: [
        'Character sheet style illustration, anime art',
        'Dynamic action pose with special effects',
        'Emotional moment with detailed expressions',
        'Scene establishing shots with background details',
        'Battle scene with multiple characters',
      ],
    };

    setStep2Result(mockStep2);
    setLoadingStep(null);
    setActiveStep(3);
  };

  const handleStep3 = async () => {
    setLoadingStep(3);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockStep3: Step3Result = {
      totalPages: parseInt(targetPages),
      scripts: [
        {
          pageNumber: 1,
          layoutSummary: 'Wide panel + 4 smaller panels (action sequence)',
          panels: [
            {
              panelNumber: 1,
              description: 'Wide shot of the protagonist standing on a cliff overlooking a vast magical landscape',
              dialogue: 'So this is the world I was never told about...',
              imagePrompt:
                'anime protagonist girl standing on cliff, magical landscape below, wide shot, sunset lighting, detailed scenery, awestruck expression',
            },
            {
              panelNumber: 2,
              description: 'Close-up of protagonist\'s face showing determination',
              dialogue: 'I have to find out what\'s happening.',
              imagePrompt:
                'close-up anime girl face, determined expression, magical glow, dramatic lighting, detailed facial features',
            },
            {
              panelNumber: 3,
              description: 'Protagonist moves forward, magical energy swirling',
              dialogue: '',
              imagePrompt:
                'anime girl moving forward, magical energy effects, action shot, dynamic pose, light trails',
            },
            {
              panelNumber: 4,
              description: 'Mysterious figure appears in the shadows',
              dialogue: 'You shouldn\'t have come here.',
              imagePrompt:
                'mysterious anime character in shadows, glowing eyes, dramatic pose, dark atmosphere',
            },
          ],
        },
        {
          pageNumber: 2,
          layoutSummary: '3-panel layout focusing on dialogue and expressions',
          panels: [
            {
              panelNumber: 1,
              description: 'Close-up of mysterious figure revealing partial face',
              dialogue: 'But since you\'re already here... there\'s much you need to learn.',
              imagePrompt:
                'mysterious character partial reveal, dramatic lighting, intense eyes',
            },
            {
              panelNumber: 2,
              description: 'Protagonist\'s shocked reaction',
              dialogue: 'Who are you?',
              imagePrompt:
                'protagonist shocked reaction, detailed expression, dramatic face lighting',
            },
            {
              panelNumber: 3,
              description: 'Wide shot revealing the mentor\'s identity',
              dialogue: 'I am the Elder, keeper of the old magic.',
              imagePrompt:
                'wise old character reveal, magical aura, detailed clothing, mystical atmosphere',
            },
          ],
        },
      ],
    };

    setStep3Result(mockStep3);
    setLoadingStep(null);
    setActiveStep(4);
  };

  const handleStep4 = async () => {
    setLoadingStep(4);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate mock images based on scripts
    const mockImages = [];
    if (step3Result) {
      let imageId = 1;
      for (const script of step3Result.scripts) {
        for (const panel of script.panels) {
          mockImages.push({
            id: `img-${imageId}`,
            pageNumber: script.pageNumber,
            panelNumber: panel.panelNumber,
            prompt: panel.imagePrompt,
            imageUrl: `https://via.placeholder.com/300x400?text=Page+${script.pageNumber}+Panel+${panel.panelNumber}`,
          });
          imageId++;
        }
      }
    }

    const mockStep4: Step4Result = {
      images: mockImages.slice(0, 12), // Show first 12 panels
    };

    setStep4Result(mockStep4);
    setLoadingStep(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStoryFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setStoryText(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex h-screen">
        {/* SIDEBAR - INPUT & CONFIGURATION */}
        <div className="w-96 bg-slate-800 border-r border-slate-700 overflow-y-auto shadow-lg">
          <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-8 flex items-center gap-2">
              <span className="text-4xl">🎨</span>
              Comic Generator
            </h1>

            {/* Story Input Section */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-2">
                  Upload Story File
                </label>
                <input
                  type="file"
                  accept=".txt,.md,.pdf"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {storyFile && (
                  <p className="mt-2 text-xs text-green-400">✓ {storyFile.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-2">
                  Story Text
                </label>
                <textarea
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder="Paste your story here or upload a file..."
                  className="w-full h-32 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="border-t border-slate-700 pt-6">
                <h3 className="text-sm font-bold text-gray-100 mb-4 uppercase tracking-wider">
                  Configuration
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Main Characters (Count)
                    </label>
                    <input
                      type="number"
                      value={mainCharacters}
                      onChange={(e) => setMainCharacters(e.target.value)}
                      min="1"
                      max="10"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Number of Chapters
                    </label>
                    <input
                      type="number"
                      value={numChapters}
                      onChange={(e) => setNumChapters(e.target.value)}
                      min="1"
                      max="20"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Target Total Pages
                    </label>
                    <input
                      type="number"
                      value={targetPages}
                      onChange={(e) => setTargetPages(e.target.value)}
                      min="1"
                      max="500"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Preferred Manga Genre & Tone
                    </label>
                    <input
                      type="text"
                      value={mangaGenre}
                      onChange={(e) => setMangaGenre(e.target.value)}
                      placeholder="e.g., Adventure, Fantasy, Dark"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Art Style Reference
                    </label>
                    <input
                      type="text"
                      value={artStyle}
                      onChange={(e) => setArtStyle(e.target.value)}
                      placeholder="e.g., Anime, Watercolor, Comic"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Max Panels per Page
                    </label>
                    <input
                      type="number"
                      value={maxPanelsPerPage}
                      onChange={(e) => setMaxPanelsPerPage(e.target.value)}
                      min="1"
                      max="12"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col bg-slate-900">
          {/* STEP NAVIGATION */}
          <div className="bg-slate-800 border-b border-slate-700 px-8 py-4">
            <div className="flex justify-between items-center">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => setActiveStep(step)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full font-bold transition-all ${
                      activeStep === step
                        ? 'bg-blue-600 text-white shadow-lg'
                        : step1Result && step >= 1
                          ? 'bg-green-600 text-white cursor-pointer hover:bg-green-700'
                          : 'bg-slate-700 text-gray-400'
                    }`}
                  >
                    {step < (step1Result ? 1 : activeStep) ? '✓' : step}
                  </button>
                  {step < 4 && (
                    <div
                      className={`w-12 h-1 mx-2 ${
                        step1Result && step < activeStep
                          ? 'bg-green-600'
                          : 'bg-slate-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-3">
              <span>Planning</span>
              <span>Designs</span>
              <span>Scripts</span>
              <span>Images</span>
            </div>
          </div>

          {/* STEP CONTENT */}
          <div className="flex-1 overflow-y-auto p-8">
            {/* STEP 1: Character Breakdowns & Planning */}
            {activeStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-white">Step 1: Planning & Breakdown</h2>
                  <button
                    onClick={handleStep1}
                    disabled={loadingStep !== null || !storyText}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                  >
                    {loadingStep === 1 ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <span>▶</span>
                        Run Step 1
                      </>
                    )}
                  </button>
                </div>

                {step1Result ? (
                  <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-700 p-4 rounded-lg">
                        <p className="text-gray-300 text-sm">Total Characters</p>
                        <p className="text-3xl font-bold text-blue-400 mt-1">
                          {step1Result.totalCharacters}
                        </p>
                      </div>
                      <div className="bg-slate-700 p-4 rounded-lg">
                        <p className="text-gray-300 text-sm">Chapters</p>
                        <p className="text-3xl font-bold text-blue-400 mt-1">
                          {step1Result.chapterDivision.length}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-700 p-4 rounded-lg">
                      <h4 className="text-gray-100 font-bold mb-2">Plot & Arc Analysis</h4>
                      <div className="text-gray-300 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {step1Result.plotAnalysis}
                      </div>
                    </div>

                    <div className="bg-slate-700 p-4 rounded-lg">
                      <h4 className="text-gray-100 font-bold mb-3">Chapter Division</h4>
                      <div className="space-y-2">
                        {step1Result.chapterDivision.map((chapter, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-600 p-3 rounded text-gray-200 text-sm flex items-start gap-3"
                          >
                            <span className="text-blue-400 font-bold">{idx + 1}.</span>
                            <span>{chapter}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-700 p-4 rounded-lg">
                      <h4 className="text-gray-100 font-bold mb-2">Scene-by-Scene Breakdown</h4>
                      <div className="text-gray-300 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {step1Result.sceneBreakdown}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
                    <p className="text-gray-400 text-lg">
                      Click "Run Step 1" to analyze your story and create the planning breakdown.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Character Designs */}
            {activeStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-white">Step 2: Character Designs</h2>
                  <button
                    onClick={handleStep2}
                    disabled={loadingStep !== null || !step1Result}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                  >
                    {loadingStep === 2 ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <span>▶</span>
                        Run Step 2
                      </>
                    )}
                  </button>
                </div>

                {step2Result ? (
                  <div className="space-y-6">
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                      <h4 className="text-gray-100 font-bold mb-3">Global Design Guidelines</h4>
                      <div className="text-gray-300 text-sm whitespace-pre-wrap">
                        {step2Result.globalGuidelines}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-gray-100 font-bold mb-4">Main Character Sheets</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {step2Result.mainCharacters.map((char, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500 transition-all"
                          >
                            <h5 className="text-blue-400 font-bold mb-2">{char.name}</h5>
                            <p className="text-gray-300 text-sm mb-3">{char.description}</p>
                            <div className="bg-slate-700 p-3 rounded text-gray-400 text-xs italic">
                              AI Prompt: {char.imagePrompt}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                      <h4 className="text-gray-100 font-bold mb-3">Recommended AI Image Prompts</h4>
                      <div className="space-y-2">
                        {step2Result.aiPrompts.map((prompt, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-700 p-3 rounded text-gray-300 text-sm flex items-start gap-3"
                          >
                            <span className="text-blue-400 font-bold flex-shrink-0">
                              {idx + 1}.
                            </span>
                            <span>{prompt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
                    <p className="text-gray-400 text-lg">
                      Complete Step 1 first, then click "Run Step 2" to generate character designs.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Panel-by-Panel Script */}
            {activeStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-white">Step 3: Panel-by-Panel Script</h2>
                  <button
                    onClick={handleStep3}
                    disabled={loadingStep !== null || !step2Result}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                  >
                    {loadingStep === 3 ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <span>▶</span>
                        Run Step 3
                      </>
                    )}
                  </button>
                </div>

                {step3Result ? (
                  <div className="space-y-4">
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <p className="text-gray-300 text-sm">Total Pages Generated</p>
                      <p className="text-3xl font-bold text-blue-400 mt-1">
                        {step3Result.totalPages}
                      </p>
                    </div>

                    <div className="space-y-4">
                      {step3Result.scripts.map((script, pageIdx) => (
                        <div
                          key={pageIdx}
                          className="bg-slate-800 rounded-lg p-6 border border-slate-700"
                        >
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
                            <h4 className="text-xl font-bold text-blue-400">
                              Page {script.pageNumber}
                            </h4>
                            <p className="text-gray-400 text-sm">{script.layoutSummary}</p>
                          </div>

                          <div className="space-y-4">
                            {script.panels.map((panel) => (
                              <div
                                key={panel.panelNumber}
                                className="bg-slate-700 p-4 rounded-lg border-l-4 border-blue-500"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h5 className="text-sm font-bold text-blue-300">
                                    Panel {panel.panelNumber}
                                  </h5>
                                </div>
                                <p className="text-gray-300 text-sm mb-2">
                                  <span className="font-semibold">Description:</span>{' '}
                                  {panel.description}
                                </p>
                                {panel.dialogue && (
                                  <p className="text-gray-300 text-sm mb-2 italic">
                                    <span className="font-semibold">Dialogue:</span> "{panel.dialogue}"
                                  </p>
                                )}
                                <p className="text-gray-400 text-xs">
                                  <span className="font-semibold">AI Prompt:</span>{' '}
                                  {panel.imagePrompt}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
                    <p className="text-gray-400 text-lg">
                      Complete Step 2 first, then click "Run Step 3" to generate panel scripts.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: Image Generation */}
            {activeStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-white">Step 4: Generated Images</h2>
                  <button
                    onClick={handleStep4}
                    disabled={loadingStep !== null || !step3Result}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                  >
                    {loadingStep === 4 ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <span>▶</span>
                        Run Step 4
                      </>
                    )}
                  </button>
                </div>

                {step4Result ? (
                  <div>
                    <div className="mb-4 text-gray-400 text-sm">
                      {step4Result.images.length} panels generated
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {step4Result.images.map((image) => (
                        <div
                          key={image.id}
                          className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-blue-500 transition-all group"
                        >
                          <div className="relative bg-slate-700 aspect-[3/4] flex items-center justify-center">
                            <img
                              src={image.imageUrl}
                              alt={`Page ${image.pageNumber} Panel ${image.panelNumber}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                              <div className="p-3 w-full">
                                <p className="text-xs text-gray-300 font-semibold">
                                  Page {image.pageNumber} • Panel {image.panelNumber}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
                    <p className="text-gray-400 text-lg">
                      Complete Step 3 first, then click "Run Step 4" to generate manga panel images.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

