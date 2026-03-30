import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../lib/auth'
import { createRoom } from '../../lib/roomApiV2'

export default function CreateRoomPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    audio: true,
    video: true,
    scheduledFor: '',
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitedMembers, setInvitedMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [successModal, setSuccessModal] = useState(false)
  const [errorModal, setErrorModal] = useState({ open: false, message: '' })
  const [createdRoomId, setCreatedRoomId] = useState('')
  const [copied, setCopied] = useState(false)

  const handleAddMember = () => {
    const email = inviteEmail.trim()
    if (email && !invitedMembers.includes(email) && email.includes('@')) {
      setInvitedMembers(prev => [...prev, email])
      setInviteEmail('')
    }
  }

  const handleRemoveMember = (email) => {
    setInvitedMembers(prev => prev.filter(e => e !== email))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.subject.trim()) {
      setErrorModal({ open: true, message: 'Please fill in all required fields.' })
      return
    }
    setLoading(true)
    try {
      const result = await createRoom({
        name: formData.name,
        subject: formData.subject,
        privacy: 'public',
        audio: formData.audio,
        video: formData.video,
        scheduledFor: formData.scheduledFor || undefined,
        invitedMembers: invitedMembers.length > 0 ? invitedMembers : undefined,
      })
      setLoading(false)
      setCreatedRoomId(result.room._id)
      setSuccessModal(true)
    } catch (error) {
      setLoading(false)
      setErrorModal({ open: true, message: error.message || 'Failed to create room.' })
    }
  }

  const basePath = import.meta.env.BASE_URL?.replace(/\/$/, '') || ''
  const roomUrl = `${window.location.origin}${basePath}/#/room/${createdRoomId}`

  const copyUrl = () => {
    navigator.clipboard.writeText(roomUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header Section - Full Width */}
      <div className="bg-[#F2CF7E] border-y border-[#e0bd6c] py-6 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-black">Study Room</h1>
          <p className="text-sm text-black/80 mt-1">Create a new collaborative study session</p>
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="max-w-4xl mx-auto">

      {/* Main Form Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* Form Content */}
          <div className="p-6 sm:p-8 space-y-8">
            {/* Basic Information Section */}
            <div className="space-y-6">
              <div className="pb-3 border-b-2 border-[#F2CF7E]">
                <h2 className="text-lg font-bold text-gray-900">Basic Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Room Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Room Name <span className="text-[#F2CF7E]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Math Study Group"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                    required
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Subject <span className="text-[#F2CF7E]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Calculus, Physics, History"
                    value={formData.subject}
                    onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Room Settings Section */}
            <div className="space-y-6">
              <div className="pb-3 border-b-2 border-[#F2CF7E]">
                <h2 className="text-lg font-bold text-gray-900">Room Settings</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Audio Toggle */}
                <div className="flex items-center justify-between p-5 bg-gradient-to-br from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-2 border-[#F2CF7E]/30 rounded-xl hover:border-[#F2CF7E] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#F2CF7E] flex items-center justify-center shadow-sm">
                      <i className="ri-mic-line text-black text-xl" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-900 block">Audio</span>
                      <span className="text-xs text-gray-600">Enable microphone</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, audio: !prev.audio }))}
                    className={`w-14 h-8 rounded-full transition-all relative shadow-inner ${formData.audio ? 'bg-[#F2CF7E]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow-lg absolute top-1 transition-transform ${formData.audio ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Video Toggle */}
                <div className="flex items-center justify-between p-5 bg-gradient-to-br from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-2 border-[#F2CF7E]/30 rounded-xl hover:border-[#F2CF7E] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#F2CF7E] flex items-center justify-center shadow-sm">
                      <i className="ri-vidicon-line text-black text-xl" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-900 block">Video</span>
                      <span className="text-xs text-gray-600">Enable camera</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, video: !prev.video }))}
                    className={`w-14 h-8 rounded-full transition-all relative shadow-inner ${formData.video ? 'bg-[#F2CF7E]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow-lg absolute top-1 transition-transform ${formData.video ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="space-y-6">
              <div className="pb-3 border-b-2 border-[#F2CF7E]">
                <h2 className="text-lg font-bold text-gray-900">Schedule</h2>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Schedule For <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledFor}
                  onChange={e => setFormData(prev => ({ ...prev, scheduledFor: e.target.value }))}
                  className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                />
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                  <i className="ri-information-line text-sm" />
                  Leave empty to start the room immediately
                </p>
              </div>
            </div>

            {/* Invite Members Section */}
            <div className="space-y-6">
              <div className="pb-3 border-b-2 border-[#F2CF7E]">
                <h2 className="text-lg font-bold text-gray-900">Invite Members</h2>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Email Addresses <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddMember())}
                    className="flex-1 h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="px-6 h-12 bg-[#F2CF7E] text-black text-sm font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <i className="ri-add-line text-lg" />
                    Add
                  </button>
                </div>
                {invitedMembers.length > 0 && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-[#F2CF7E]/10 to-[#F2CF7E]/5 rounded-lg border-2 border-[#F2CF7E]/30">
                    <p className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <i className="ri-team-line text-[#F2CF7E]" />
                      Invited Members ({invitedMembers.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {invitedMembers.map(email => (
                        <span key={email} className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-900 rounded-lg text-sm border-2 border-[#F2CF7E]/30 shadow-sm hover:border-[#F2CF7E] transition-colors">
                          <i className="ri-user-line text-[#F2CF7E]" />
                          <span className="font-medium">{email}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveMember(email)} 
                            className="ml-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <i className="ri-close-line text-lg" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Footer */}
          <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-700 font-medium">
              <span className="text-[#F2CF7E] font-bold">*</span> Required fields
            </p>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 sm:flex-none px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none px-8 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-lg" />
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="ri-add-circle-line text-lg" />
                    Create Room
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Success Modal */}
      <Modal isOpen={successModal} onClose={() => setSuccessModal(false)}>
        <div className="p-6 sm:p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-[#F2CF7E]/20 flex items-center justify-center mx-auto mb-5">
            <i className="ri-check-line text-4xl text-[#F2CF7E]" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Room Created Successfully!</h3>
          <p className="text-sm text-gray-600 mb-6">Share this link with others to join your study session.</p>
          <div className="flex gap-2 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="text"
              readOnly
              value={roomUrl}
              className="flex-1 h-10 px-3 rounded-lg border-0 text-sm bg-transparent text-gray-700 focus:outline-none"
            />
            <button
              onClick={copyUrl}
              className={`px-5 h-10 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${copied ? 'bg-[#F2CF7E] text-black' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              <i className={copied ? 'ri-check-line' : 'ri-file-copy-line'} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setSuccessModal(false); navigate('/rooms') }}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => navigate(`/room/${createdRoomId}`)}
              className="px-6 py-3 bg-[#F2CF7E] text-black rounded-lg text-sm font-semibold hover:bg-[#e0bd6c] transition-colors flex items-center gap-2"
            >
              <i className="ri-door-open-line text-lg" />
              Enter Room
            </button>
          </div>
        </div>
      </Modal>

      {/* Error Modal */}
      <Modal isOpen={errorModal.open} onClose={() => setErrorModal({ open: false, message: '' })}>
        <div className="p-6 sm:p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
            <i className="ri-error-warning-line text-4xl text-red-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Error</h3>
          <p className="text-sm text-gray-600 mb-6">{errorModal.message}</p>
          <button
            onClick={() => setErrorModal({ open: false, message: '' })}
            className="px-6 py-3 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Close
          </button>
        </div>
      </Modal>
      </div>
    </div>
  )
}
