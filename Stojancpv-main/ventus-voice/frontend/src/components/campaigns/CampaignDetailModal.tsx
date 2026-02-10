/**
 * Campaign Detail Modal
 *
 * Shows detailed information about a campaign including stats,
 * contacts, and actions.
 *
 * Part of Phase 1 - P0 Journey (P0J-08)
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  X,
  Phone,
  Users,
  TrendingUp,
  Calendar,
  Play,
  Pause,
  Trash2,
  Download,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  agentId: string;
  agentName: string;
  contactsCount: number;
  completedCount: number;
  successRate: number;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CampaignDetailModalProps {
  campaign: Campaign;
  open: boolean;
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function CampaignDetailModal({
  campaign,
  open,
  onClose,
}: CampaignDetailModalProps) {
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = campaign.status === 'active' ? 'paused' : 'active';
      await apiClient.patch(`/api/campaigns/${campaign.id}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(
        `Campaign ${campaign.status === 'active' ? 'paused' : 'resumed'}`,
      );
    },
    onError: () => {
      toast.error('Failed to update campaign status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/api/campaigns/${campaign.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign deleted');
      onClose();
    },
    onError: () => {
      toast.error('Failed to delete campaign');
    },
  });

  if (!open) return null;

  const progressPercent = (campaign.completedCount / campaign.contactsCount) * 100;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-[hsl(var(--void))]/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="container mx-auto h-full flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          >
            <Card
              className={cn(
                'bg-[#121212]/90 backdrop-blur-xl',
                'border-[#27272A]/50',
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-6 border-b border-[#27272A]">
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-[#EDEDED] mb-1">
                    {campaign.name}
                  </h2>
                  <p className="text-[#A1A1AA]">{campaign.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-[#A1A1AA] hover:text-[#EDEDED]"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-[#27272A]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[#A1A1AA] text-sm">
                    <Users className="w-4 h-4" />
                    Total Contacts
                  </div>
                  <p className="text-2xl font-semibold text-[#EDEDED]">
                    {campaign.contactsCount.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[#A1A1AA] text-sm">
                    <BarChart3 className="w-4 h-4" />
                    Completed
                  </div>
                  <p className="text-2xl font-semibold text-[#EDEDED]">
                    {campaign.completedCount.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[#A1A1AA] text-sm">
                    <TrendingUp className="w-4 h-4" />
                    Success Rate
                  </div>
                  <p className="text-2xl font-semibold text-[#4ADE80]">
                    {campaign.successRate.toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[#A1A1AA] text-sm">
                    <Phone className="w-4 h-4" />
                    Agent
                  </div>
                  <p className="text-base font-medium text-[#EDEDED] truncate">
                    {campaign.agentName}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="p-6 space-y-3 border-b border-[#27272A]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#A1A1AA]">Campaign Progress</span>
                  <span className="text-[#EDEDED] font-medium">
                    {progressPercent.toFixed(0)}%
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {/* Tabs */}
              <Tabs defaultValue="overview" className="p-6">
                <TabsList className="bg-[#27272A]/50">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="contacts">Contacts</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-[#A1A1AA]">Start Date</p>
                      <p className="text-[#EDEDED]">
                        {new Date(campaign.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-[#A1A1AA]">End Date</p>
                      <p className="text-[#EDEDED]">
                        {campaign.endDate
                          ? new Date(campaign.endDate).toLocaleDateString()
                          : 'Ongoing'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-[#A1A1AA]">Created</p>
                      <p className="text-[#EDEDED]">
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-[#A1A1AA]">Last Updated</p>
                      <p className="text-[#EDEDED]">
                        {new Date(campaign.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="contacts" className="space-y-4 mt-6">
                  <p className="text-[#A1A1AA] text-center py-8">
                    Contact management coming soon...
                  </p>
                </TabsContent>

                <TabsContent value="analytics" className="space-y-4 mt-6">
                  <p className="text-[#A1A1AA] text-center py-8">
                    Analytics dashboard coming soon...
                  </p>
                </TabsContent>
              </Tabs>

              {/* Actions */}
              <div className="flex items-center justify-between p-6 border-t border-[#27272A]">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  className="border-[#F87171] text-[#F87171] hover:bg-[#F87171]/10"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 me-2" />
                  Delete
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-[#27272A] hover:bg-[#27272A]/50"
                  >
                    <Download className="w-4 h-4 me-2" />
                    Export
                  </Button>
                  <Button
                    onClick={() => toggleStatusMutation.mutate()}
                    disabled={toggleStatusMutation.isPending}
                    className={cn(
                      'bg-[#99CDFF] text-[#050505]',
                      'hover:bg-[#BDDCFF]',
                      'hover:shadow-[0_0_20px_rgba(153,205,255,0.3)]',
                    )}
                  >
                    {campaign.status === 'active' ? (
                      <>
                        <Pause className="w-4 h-4 me-2" />
                        Pause Campaign
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 me-2" />
                        Resume Campaign
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#121212] border-[#27272A]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#EDEDED]">
              Delete campaign?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#A1A1AA]">
              This will permanently delete "{campaign.name}" and all associated
              data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#27272A] hover:bg-[#27272A]/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-[#F87171] hover:bg-[#F87171]/90"
            >
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
