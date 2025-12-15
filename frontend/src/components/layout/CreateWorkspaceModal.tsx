/**
 * Create Workspace Modal
 *
 * WHY: Allow users to create new workspaces in current organization
 * HOW: Modal dialog with form for workspace name and optional description
 *
 * FEATURES:
 * - Name input (required)
 * - Description input (optional)
 * - Create button
 * - Cancel button
 * - Error handling
 * - Auto-switch to new workspace after creation
 */

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceModal({ open, onOpenChange }: CreateWorkspaceModalProps) {
  const { createWorkspace, switchWorkspace } = useApp();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }

    try {
      setIsLoading(true);

      // Create workspace
      const newWorkspace = await createWorkspace(name.trim(), description.trim() || undefined);

      // Switch to new workspace
      await switchWorkspace(newWorkspace.id);

      // Reset form and close
      setName("");
      setDescription("");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Failed to create workspace:", err);
      setError(err.message || "Failed to create workspace");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset form when modal closes
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setDescription("");
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Create a new workspace to organize your chatbots, knowledge bases, and resources.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Workspace Name */}
            <div className="space-y-2">
              <Label htmlFor="workspace-name">
                Workspace Name <span className="text-error-500">*</span>
              </Label>
              <Input
                id="workspace-name"
                placeholder="e.g., Production, Development, Testing"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                required
                maxLength={50}
              />
            </div>

            {/* Workspace Description */}
            <div className="space-y-2">
              <Label htmlFor="workspace-description">Description (Optional)</Label>
              <Textarea
                id="workspace-description"
                placeholder="Describe the purpose of this workspace..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
                maxLength={200}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Workspace"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
