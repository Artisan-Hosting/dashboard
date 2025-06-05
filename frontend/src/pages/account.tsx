// 'use client'
import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/useUser'
import { fetchWithAuth } from '@/lib/api'
import { useRouter } from 'next/router'
import { Sidebar } from '@/components/header'
import { handleLogout } from '@/lib/logout'

export default function AccountPage() {
  const router = useRouter()
  const { username, email: loadedEmail, isLoading, error } = useUser()

  // Editable state for email:
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [prettyName, setPrettyName] = useState<string>('')
  const [feedback, setFeedback] = useState<string>('')

  // Once useUser finishes loading, seed `email` input field:
  useEffect(() => {
    if (!isLoading && loadedEmail) {
      setEmail(loadedEmail)
    }
  }, [isLoading, loadedEmail])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0b0c10] text-white">
        Loading user…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0b0c10] text-red-400">
        Error loading user info: {error.message}
      </div>
    )
  }

  // const handleUpdateEmail = async () => {
  //   try {
  //     const res = await fetchWithAuth('account/email', {
  //       method: 'PUT',
  //       body: JSON.stringify({ email }),
  //     })
  //     if (res?.status === 'success') {
  //       setFeedback('Email updated.')
  //     } else {
  //       setFeedback('Error updating email.')
  //     }
  //   } catch {
  //     setFeedback('Error updating email.')
  //   }
  // }

  return (
    <div className="min-h-screen flex bg-page text-foreground">
      <Sidebar onLogout={handleLogout} />

      {/* Main content on the right */}
      <div className="flex-1 p-8 space-y-12">
        <h1 className="text-3xl font-bold text-purple-400">Account Settings</h1>

        {/* 1. User Info */}
        <section className="card p-6">
          <h2 className="text-xl font-semibold text-purple-300 mb-4">User Info</h2>
          <div className="flex items-center space-x-4">
            <img
              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
                username
              )}`}
              alt="avatar"
              className="w-14 h-14 rounded-full border border-purple-500"
            />
            <div>
              <p className="text-white font-medium">{username}</p>
              <p className="text-sm text-gray-400">{loadedEmail}</p>
            </div>
          </div>
        </section>

        {/* 2. Security Settings */}
        <section className="card p-6 space-y-6">
          <h2 className="text-xl font-semibold text-purple-300 mb-2">Security Settings</h2>
          <div className="space-y-2">
            <label className="block text-sm">New Password</label>
            <input
              type="password"
              className="w-full p-2 rounded bg-gray-800 text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="block text-sm mt-2">Confirm Password</label>
            <input
              type="password"
              className="w-full p-2 rounded bg-gray-800 text-white"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {/* <button …>Change Password</button> */}
          </div>
          <div className="space-y-2">
            <label className="block text-sm">Update Email</label>
            <input
              type="email"
              className="w-full p-2 rounded bg-gray-800 text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {/* <button
              onClick={handleUpdateEmail}
              className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
            >
              Update Email
            </button> */}
          </div>
        </section>

        {/* 3. Personalization */}
        <section className="card p-6">
          <h2 className="text-xl font-semibold text-purple-300 mb-4">Personalization</h2>
          <label className="block text-sm mb-2">Set Pretty Project Name</label>
          <input
            type="text"
            className="w-full p-2 rounded bg-gray-800 text-white mb-2"
            value={prettyName}
            onChange={(e) => setPrettyName(e.target.value)}
          />
          {/* <button …>Save Pretty Name</button> */}
        </section>

        {/* 4. Danger Zone */}
        <section className="bg-[#2a2f45] p-6 rounded-xl border border-red-600">
          <h2 className="text-xl font-semibold text-red-400 mb-4">Danger Zone</h2>
          <div className="space-y-4">
            <button
              onClick={() => {
                router.push('/login')
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded opacity-50 cursor-not-allowed"
            >
              Logout of All Devices (Coming Soon)
            </button>
            <button className="px-4 py-2 bg-red-700 hover:bg-red-800 rounded opacity-50 cursor-not-allowed">
              Delete Account (Coming Soon)
            </button>
          </div>
        </section>

        {feedback && (
          <div className="text-sm text-green-400 mt-4">{feedback}</div>
        )}
      </div>
    </div>
  )
}
