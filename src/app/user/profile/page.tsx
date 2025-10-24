"use client"

import { useState } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Edit2, Check, X, Calendar, Wallet } from "lucide-react"
import Button from "@/app/components/ui/button"

export default function UserProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [user, setUser] = useState({
    name: "Rahul Sharma",
    email: "rahul.sharma@example.com",
    phone: "+91 98765 43210",
    address: "23, MG Road, Bengaluru, India",
    joined: "12 Jan 2024",
    balance: "₹45,000",
    group: "Group B - Standard",
    photo: "https://i.pravatar.cc/150?img=5",
  })

  const [editedUser, setEditedUser] = useState(user)

  const handleEditToggle = () => {
    if (isEditing) setUser(editedUser)
    setIsEditing(!isEditing)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] bg-[var(--bg-main)] px-4 py-0 md:py-6  sm:p-8">
      <Card className="w-full max-w-md border-0 shadow-lg rounded-2xl bg-[var(--bg-card)] text-[var(--text-primary)]">
        <CardContent className="p-0 md:p-6 sm:p-8 flex flex-col items-center gap-5">

          {/* Profile Photo */}
          <div className="relative">
            <img
              src={user.photo}
              alt="Profile"
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4"
              style={{ borderColor: "var(--color-primary)" }}
            />
          </div>

          {/* User Info */}
          <div className="w-full space-y-4">
            {/* Full Name */}
            <div>
              <Label className="text-sm text-[var(--text-secondary)]">Full Name</Label>
              <Input
                type="text"
                value={editedUser.name}
                disabled={!isEditing}
                onChange={(e) =>
                  setEditedUser({ ...editedUser, name: e.target.value })
                }
                className={`mt-1 ${
                  isEditing ? "border-[var(--color-primary)]" : "border-transparent"
                } bg-[var(--bg-input)] text-[var(--text-primary)]`}
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <Label className="text-sm text-[var(--text-secondary)]">Email</Label>
              <Input
                type="email"
                value={user.email}
                disabled
                className="mt-1 border-transparent bg-[var(--bg-input)] text-[var(--text-primary)]"
              />
            </div>

            {/* Phone (read-only) */}
            <div>
              <Label className="text-sm text-[var(--text-secondary)]">Phone Number</Label>
              <Input
                type="text"
                value={user.phone}
                disabled
                className="mt-1 border-transparent bg-[var(--bg-input)] text-[var(--text-primary)]"
              />
            </div>

            {/* Address (editable) */}
            <div>
              <Label className="text-sm text-[var(--text-secondary)]">Address</Label>
              <Input
                type="text"
                value={editedUser.address}
                disabled={!isEditing}
                onChange={(e) =>
                  setEditedUser({ ...editedUser, address: e.target.value })
                }
                className={`mt-1 ${
                  isEditing ? "border-[var(--color-primary)]" : "border-transparent"
                } bg-[var(--bg-input)] text-[var(--text-primary)]`}
              />
            </div>

            {/* Group Info */}
            <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
                <div>
                  <p className="text-[var(--text-secondary)]">Balance</p>
                  <p className="font-semibold">{user.balance}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--color-secondary)]" />
                <div>
                  <p className="text-[var(--text-secondary)]">Joined</p>
                  <p className="font-semibold">{user.joined}</p>
                </div>
              </div>
            </div>

            {/* Chit Group */}
            <div className="pt-2">
              <Label className="text-sm text-[var(--text-secondary)]">Chit Group</Label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-[var(--bg-highlight)] text-[var(--text-primary)] font-medium">
                {user.group}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-3 pt-4">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  className="px-5 bg-[var(--color-secondary)] text-[var(--text-light)]"
                  onClick={handleEditToggle}
                >
                  <Check className="w-4 h-4 mr-1" /> Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="px-5 border-[var(--border-color)] text-[var(--text-primary)]"
                  onClick={() => {
                    setEditedUser(user)
                    setIsEditing(false)
                  }}
                >
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="px-5 bg-[var(--color-primary)] text-[var(--text-light)]"
                onClick={handleEditToggle}
              >
                <Edit2 className="w-4 h-4 mr-1" /> Edit Profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
