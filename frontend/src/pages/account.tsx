// 'use client'
import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/useUser'

import { Sidebar } from '@/components/header'
import LoadingOverlay from '@/components/loading'
import { handleLogout, handleLogoutAll } from '@/lib/logout'
import { API_URL } from '@/lib/config'
import { Button, Field } from '@/components/ui'

export default function AccountPage() {
  const { username, email: loadedEmail, isLoading, error } = useUser()

  // Editable state for email:
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [prettyName, setPrettyName] = useState<string>('')
  const [feedback, setFeedback] = useState<string>('')

  const handleUpdateEmail = async () => {
    try {
      const res = await fetch(
        `${API_URL}/account/email`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      )
      if (res.ok) {
        setFeedback('Email updated.')
      } else {
        setFeedback('Error updating email.')
      }
    } catch {
      setFeedback('Error updating email.')
    }
  }

  const handleChangePassword = async () => {
    if (password !== confirmPassword) {
      setFeedback('Passwords do not match.')
      return
    }
    try {
      const res = await fetch(
        `${API_URL}/account/password`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password }),
        }
      )
      if (res.ok) {
        setFeedback('Password updated.')
        setPassword('')
        setConfirmPassword('')
      } else {
        setFeedback('Error updating password.')
      }
    } catch {
      setFeedback('Error updating password.')
    }
  }

  // Once useUser finishes loading, seed `email` input field:
  useEffect(() => {
    if (!isLoading && loadedEmail) {
      setEmail(loadedEmail)
    }
  }, [isLoading, loadedEmail])


  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-page text-red-400">
        Error loading user info: {error.message}
      </div>
    )
  }


  return (
    <div className="relative min-h-screen flex bg-page text-foreground">
      <Sidebar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      {/* Main content on the right */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-12">
        <h1 className="text-3xl font-bold text-brand">Account Settings</h1>

        {/* 1. User Info */}
        <section className="card p-6">
          <h2 className="text-xl font-semibold text-brand mb-4">User Info</h2>
          <div className="flex items-center space-x-4">
            <img
              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
                username
              )}`}
              alt="avatar"
              className="w-14 h-14 rounded-full border border-brand"
            />
            <div>
              <p className="font-medium" style={{ color: 'var(--strong)' }}>{username}</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{loadedEmail}</p>
            </div>
          </div>
        </section>

        {/* 2. Security Settings */}
        <section className="card p-6 space-y-6">
          <h2 className="text-xl font-semibold text-brand mb-2">Security Settings</h2>
          <div className="space-y-2">
            <label className="block text-sm">New Password</label>
            <Field sans type="password" className="w-full" value={password} onChange={(e) => setPassword(e.target.value)} />
            <label className="block text-sm mt-2">Confirm Password</label>
            <Field sans type="password" className="w-full" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <Button onClick={handleChangePassword} className="mt-2">
              Change Password
            </Button>
          </div>
          <div className="space-y-2">
            <label className="block text-sm">Update Email</label>
            <Field sans type="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button onClick={handleUpdateEmail} className="mt-2">
              Update Email
            </Button>
          </div>
        </section>

        {/* 3. Personalization */}
        <section className="card p-6">
          <h2 className="text-xl font-semibold text-brand mb-4">Personalization</h2>
          <label className="block text-sm mb-2">Set Pretty Project Name</label>
          <Field sans type="text" className="w-full mb-2" value={prettyName} onChange={(e) => setPrettyName(e.target.value)} />
          {/* <button …>Save Pretty Name</button> */}
        </section>

        {/* 4. Danger Zone */}
        <section className="bg-brand-gradient text-white p-6 rounded-xl" style={{ border: '1px solid var(--bad)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--bad)' }}>Danger Zone</h2>
          <div className="space-y-4">
            <Button variant="danger" onClick={handleLogoutAll}>
              Logout of All Devices
            </Button>
            <Button variant="danger" disabled title="Coming soon">
              Delete Account (Coming Soon)
            </Button>
          </div>
        </section>

        {feedback && (
          <div className="text-sm text-green-400 mt-4">{feedback}</div>
        )}
      </div>
      {isLoading && <LoadingOverlay />}
    </div>
  )
}
