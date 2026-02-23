import { useState, useEffect } from 'react'
import Modal from '../../../components/ui/Modal'
import { getSocket } from '../../../lib/socket'

export default function TasksPanel({ roomId }) {
  const [tasks, setTasks] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTask, setNewTask] = useState({ text: '', dueDate: '' })

  // Subscribe to real-time task events
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleRoomState = (state) => {
      if (state.tasks) setTasks(state.tasks)
    }

    const handleTasksUpdated = (updatedTasks) => {
      setTasks(updatedTasks)
    }

    socket.on('room-state', handleRoomState)
    socket.on('tasks-updated', handleTasksUpdated)

    return () => {
      socket.off('room-state', handleRoomState)
      socket.off('tasks-updated', handleTasksUpdated)
    }
  }, [])

  const addTask = () => {
    if (!newTask.text.trim()) return
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('task-add', {
        meetingId: roomId,
        task: { text: newTask.text.trim(), dueDate: newTask.dueDate },
      })
    }
    setNewTask({ text: '', dueDate: '' })
    setShowAddModal(false)
  }

  const toggleTask = (id) => {
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('task-toggle', { meetingId: roomId, taskId: id })
    }
  }

  const deleteTask = (id) => {
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('task-delete', { meetingId: roomId, taskId: id })
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700">
          Study Tasks
          <span className="ml-2 text-[10px] font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Shared</span>
        </h4>
        <button onClick={() => setShowAddModal(true)} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          + Add Task
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {tasks.map(task => (
          <div key={task.id} className="flex items-start gap-2 p-2 group">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
              className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {task.text}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {task.dueDate && (
                  <p className="text-xs text-gray-400">{formatDate(task.dueDate)}</p>
                )}
                {task.createdBy && (
                  <span className="text-[10px] text-gray-400">by {task.createdBy}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => deleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"
            >
              <i className="ri-delete-bin-line text-sm" />
            </button>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <i className="ri-task-line text-3xl" />
            <p className="text-sm mt-2">No tasks yet</p>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Add Task</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Task name"
              value={newTask.text}
              onChange={e => setNewTask(prev => ({ ...prev, text: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            />
            <input
              type="datetime-local"
              value={newTask.dueDate}
              onChange={e => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowAddModal(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={addTask} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
