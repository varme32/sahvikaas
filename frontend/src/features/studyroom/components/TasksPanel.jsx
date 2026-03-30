import { useState, useEffect } from 'react'
import Modal from '../../../components/ui/Modal'
import { getSocket } from '../../../lib/socket'

export default function TasksPanel({ roomId, userName, tasks, setTasks, participants }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTask, setNewTask] = useState({ text: '', dueDate: '', priority: 'medium', assignedTo: 'all' })
  const [filter, setFilter] = useState('all') // all | mine | completed | pending

  const addTask = () => {
    if (!newTask.text.trim()) return
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('task-add', {
        meetingId: roomId,
        task: {
          text: newTask.text.trim(),
          dueDate: newTask.dueDate,
          priority: newTask.priority,
          assignedTo: newTask.assignedTo,
        },
      })
    }
    setNewTask({ text: '', dueDate: '', priority: 'medium', assignedTo: 'all' })
    setShowAddModal(false)
  }

  const toggleTask = (id) => {
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('task-toggle', { meetingId: roomId, taskId: id, userName })
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

  const isOverdue = (dateStr) => {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  const priorityColors = {
    high: 'text-red-600 bg-red-50 border-red-200',
    medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    low: 'text-green-600 bg-green-50 border-green-200',
  }

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'completed') return task.completed
    if (filter === 'pending') return !task.completed
    if (filter === 'mine') return task.createdBy === userName
    return true
  })

  // Stats
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.completed).length
  const pendingTasks = totalTasks - completedTasks
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Get unique participant names for assignment
  const participantNames = participants?.map(p => p.name) || []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">
            Study Tasks
            <span className="ml-2 text-[10px] font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Shared</span>
          </h4>
          <button onClick={() => setShowAddModal(true)} className="text-sm text-black hover:text-[#e0bd6c] font-medium">
            + Add Task
          </button>
        </div>

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{completedTasks}/{totalTasks} completed</span>
              <span>{completionPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-1 mt-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All', count: totalTasks },
            { id: 'pending', label: 'Pending', count: pendingTasks },
            { id: 'completed', label: 'Done', count: completedTasks },
            { id: 'mine', label: 'My Tasks', count: tasks.filter(t => t.createdBy === userName).length },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                filter === f.id ? 'bg-[#F2CF7E]/20 text-black font-medium' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {filteredTasks.map(task => (
          <div
            key={task.id}
            className={`p-3 rounded-lg border transition-all group ${
              task.completed ? 'border-green-100 bg-green-50/50' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
                className="mt-0.5 rounded border-gray-300 text-green-500 focus:ring-green-400"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {task.text}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {/* Priority badge */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${priorityColors[task.priority] || priorityColors.medium}`}>
                    {(task.priority || 'medium').charAt(0).toUpperCase() + (task.priority || 'medium').slice(1)}
                  </span>

                  {/* Assignment */}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                    <i className="ri-user-line mr-0.5" />
                    {task.assignedTo === 'all' ? 'Everyone' : task.assignedTo}
                  </span>

                  {/* Due date */}
                  {task.dueDate && (
                    <span className={`text-[10px] flex items-center gap-0.5 ${
                      isOverdue(task.dueDate) && !task.completed ? 'text-red-500 font-medium' : 'text-gray-400'
                    }`}>
                      <i className="ri-time-line" />
                      {formatDate(task.dueDate)}
                      {isOverdue(task.dueDate) && !task.completed && ' (Overdue)'}
                    </span>
                  )}

                  {/* Created by */}
                  <span className="text-[10px] text-gray-400">by {task.createdBy}</span>

                  {/* Completed by */}
                  {task.completed && task.completedBy && (
                    <span className="text-[10px] text-green-600">
                      <i className="ri-check-line mr-0.5" />done by {task.completedBy}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all shrink-0"
              >
                <i className="ri-delete-bin-line text-sm" />
              </button>
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <i className="ri-task-line text-3xl" />
            <p className="text-sm mt-2">
              {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
            </p>
            <p className="text-xs mt-1">Anyone can create tasks for the room</p>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Add Task</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Task Name *</label>
              <input
                type="text"
                placeholder="What needs to be done?"
                value={newTask.text}
                onChange={e => setNewTask(prev => ({ ...prev, text: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E] bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Assign To</label>
                <select
                  value={newTask.assignedTo}
                  onChange={e => setNewTask(prev => ({ ...prev, assignedTo: e.target.value }))}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E] bg-white"
                >
                  <option value="all">Everyone</option>
                  {participantNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Due Date (optional)</label>
              <input
                type="datetime-local"
                value={newTask.dueDate}
                onChange={e => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowAddModal(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={addTask} className="px-4 py-1.5 text-sm bg-[#F2CF7E] text-white rounded-lg hover:bg-[#e0bd6c]">
              Add Task
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

