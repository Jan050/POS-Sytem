// Format number as Philippine Peso
export const formatPeso = (amount) => {
  if (amount === null || amount === undefined) return '₱0.00'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount)
}

// Format date to readable string
export const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Format datetime
export const formatDateTime = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format time only
export const formatTime = (dateStr) => {
  return new Date(dateStr).toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Generate short order ID from MongoDB _id
export const shortId = (id) => id?.slice(-6).toUpperCase() || 'N/A'

// Get category color for badge
export const categoryColor = (category) => {
  const map = {
    Beverages: 'bg-blue-500/20 text-blue-300',
    Snacks: 'bg-orange-500/20 text-orange-300',
    'Canned Goods': 'bg-red-500/20 text-red-300',
    Noodles: 'bg-yellow-500/20 text-yellow-300',
    Condiments: 'bg-green-500/20 text-green-300',
    'Personal Care': 'bg-purple-500/20 text-purple-300',
    Cigarettes: 'bg-gray-500/20 text-gray-300',
    Bread: 'bg-amber-500/20 text-amber-300',
    Dairy: 'bg-cyan-500/20 text-cyan-300',
  }
  return map[category] || 'bg-slate-500/20 text-slate-300'
}
