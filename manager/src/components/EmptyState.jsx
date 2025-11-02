import { BookmarkPlus, Chrome } from 'lucide-react'

function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md px-6">
        <div className="mb-6 flex justify-center">
          <div className="p-6 bg-accent/10 dark:bg-accent-dark/10 rounded-full">
            <BookmarkPlus className="w-16 h-16 text-accent dark:text-accent-dark" />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-3">Welcome to BookSmart!</h2>

        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-8">
          Your intelligent bookmark library is empty. Start saving bookmarks using the Chrome extension
          and they'll appear here with AI-generated summaries and tags.
        </p>

        <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg p-6 text-left">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Chrome className="w-5 h-5 text-accent dark:text-accent-dark" />
            Getting Started
          </h3>
          <ol className="space-y-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            <li className="flex gap-2">
              <span className="font-medium text-accent dark:text-accent-dark">1.</span>
              <span>Install the BookSmart Chrome extension</span>
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-accent dark:text-accent-dark">2.</span>
              <span>Click the bookmark icon when viewing any webpage</span>
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-accent dark:text-accent-dark">3.</span>
              <span>Watch as AI generates smart summaries and tags</span>
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-accent dark:text-accent-dark">4.</span>
              <span>Use search and filters to find bookmarks instantly</span>
            </li>
          </ol>
        </div>

        <div className="mt-8">
          <a
            href="https://github.com/yourusername/booksmart"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Chrome className="w-5 h-5" />
            Download Chrome Extension
          </a>
        </div>
      </div>
    </div>
  )
}

export default EmptyState
