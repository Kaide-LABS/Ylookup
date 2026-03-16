"use client";

import { useState } from "react";
import UploadZone from "@/components/UploadZone";
import ProcessingStatus from "@/components/ProcessingStatus";
import ExtractionResults from "@/components/ExtractionResults";

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUploadStart = (id: string) => {
    setJobId(id);
    setError(null);
    setResults(null);
  };

  const handleComplete = (data: any) => {
    setResults(data);
    setJobId(null);
  };

  const handleError = (errMsg: string) => {
    setError(errMsg);
    setJobId(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
            UDINA
          </h1>
          <p className="mt-3 text-xl text-gray-500 sm:mt-4">
            Financial Document Intelligence
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-8 bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!jobId && !results && (
          <UploadZone onUploadStart={handleUploadStart} onError={handleError} />
        )}

        {jobId && (
          <ProcessingStatus jobId={jobId} onComplete={handleComplete} onError={handleError} />
        )}

        {results && (
          <div className="space-y-8">
            <button
              onClick={() => setResults(null)}
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              &larr; Upload another document
            </button>
            <ExtractionResults data={results} />
          </div>
        )}
      </div>
    </main>
  );
}
