import { useState, useRef } from 'react'

export default function VideoPanel() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const panelRef = useRef(null)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && panelRef.current) {
      panelRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else if (document.fullscreenElement) {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  return (
    <div ref={panelRef} className="bg-white border-b border-gray-200 flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <i className="ri-vidicon-line text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-800">Video Grid</h3>
          <span className="text-xs text-gray-400 ml-1">0 participants</span>
        </div>
        <button
          onClick={toggleFullscreen}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
        >
          <i className={isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} />
        </button>
      </div>

      {/* Video Area */}
      <div className="flex-1 flex items-center justify-center bg-gray-900 p-4">
        {/* Local video placeholder */}
        <div className="relative w-full h-full rounded-lg bg-gray-800 flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gray-700/80 flex items-center justify-center mb-3">
            <i className="ri-vidicon-off-line text-3xl text-gray-500" />
          </div>
          <p className="text-sm text-gray-400">Camera is off</p>
          <p className="text-xs text-gray-500 mt-1">Click the video button in the toolbar to start</p>
          {/* Name overlay */}
          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 text-white text-xs rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            You
          </div>
        </div>
      </div>
    </div>
  )
}
