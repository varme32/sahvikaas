import { useNavigate } from 'react-router-dom'

export default function WaitingScreen({ roomName, onCancel }) {
  const navigate = useNavigate()

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      navigate('/rooms')
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-[#F2CF7E] rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <i className="ri-time-line text-4xl text-black" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Waiting for Host Approval
          </h2>
          
          <p className="text-gray-600 mb-6">
            You're in the waiting room for <span className="font-semibold">{roomName}</span>. 
            The host will admit you shortly.
          </p>

          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-2 h-2 bg-[#F2CF7E] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-[#F2CF7E] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-[#F2CF7E] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <i className="ri-information-line text-blue-600 text-xl mt-0.5" />
              <div className="text-left text-sm text-blue-800">
                <p className="font-medium mb-1">While you wait:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Make sure your camera and microphone are ready</li>
                  <li>Check your internet connection</li>
                  <li>The host will be notified of your request</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel and Leave
          </button>
        </div>
      </div>
    </div>
  )
}
