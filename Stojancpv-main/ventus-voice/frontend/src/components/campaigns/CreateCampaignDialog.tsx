/**
 * Create Campaign Dialog
 *
 * Modal dialog for creating new campaigns with form validation.
 *
 * Part of Phase 1 - P0 Journey (P0J-07)
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// ============================================================================
// Schema
// ============================================================================

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100),
  description: z.string().optional(),
  agentId: z.string().min(1, 'Agent selection is required'),
  startDate: z.string().optional(),
  targetCount: z.number().min(1, 'Must have at least 1 contact').optional(),
});

type CreateCampaignData = z.infer<typeof createCampaignSchema>;

// ============================================================================
// API Functions
// ============================================================================

async function createCampaign(data: CreateCampaignData) {
  const response = await apiClient.post('/api/campaigns', data);
  return response.data.data;
}

async function getAgents() {
  const response = await apiClient.get('/api/agents');
  return response.data.data;
}

// ============================================================================
// Component
// ============================================================================

interface CreateCampaignDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateCampaignDialog({
  open,
  onClose,
}: CreateCampaignDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateCampaignData>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      name: '',
      description: '',
      agentId: '',
      startDate: new Date().toISOString().split('T')[0],
      targetCount: 0,
    },
  });

  // Fetch agents for selection
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign created successfully');
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create campaign');
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    createMutation.mutate(data);
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-[hsl(var(--void))]/60 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg"
        >
          <Card
            className={cn(
              'bg-[#121212]/90 backdrop-blur-xl',
              'border-[#27272A]/50',
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-[#27272A]">
              <div>
                <h2 className="text-2xl font-semibold text-[#EDEDED]">
                  Create Campaign
                </h2>
                <p className="text-[#A1A1AA] mt-1">
                  Set up a new voice AI outreach campaign
                </p>
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Campaign Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[#EDEDED]">
                  Campaign Name *
                </Label>
                <Input
                  {...form.register('name')}
                  id="name"
                  placeholder="Q1 2024 Lead Outreach"
                  className={cn(
                    'bg-[#121212] border-[#27272A]',
                    'text-[#EDEDED] placeholder-[#A1A1AA]',
                    'focus:border-[#99CDFF] focus:ring-2 focus:ring-[#99CDFF]/20',
                    form.formState.errors.name && 'border-[#F87171]',
                  )}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-[#F87171]">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-[#EDEDED]">
                  Description
                </Label>
                <Textarea
                  {...form.register('description')}
                  id="description"
                  placeholder="Brief description of campaign goals and target audience..."
                  rows={3}
                  className={cn(
                    'bg-[#121212] border-[#27272A]',
                    'text-[#EDEDED] placeholder-[#A1A1AA]',
                    'focus:border-[#99CDFF] focus:ring-2 focus:ring-[#99CDFF]/20',
                  )}
                />
              </div>

              {/* Agent Selection */}
              <div className="space-y-2">
                <Label htmlFor="agentId" className="text-[#EDEDED]">
                  Select Agent *
                </Label>
                {agentsLoading ? (
                  <div className="flex items-center gap-2 p-3 bg-[#121212] border border-[#27272A] rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-[#99CDFF]" />
                    <span className="text-[#A1A1AA]">Loading agents...</span>
                  </div>
                ) : (
                  <Select
                    value={form.watch('agentId')}
                    onValueChange={(value) => form.setValue('agentId', value)}
                  >
                    <SelectTrigger
                      id="agentId"
                      className={cn(
                        'bg-[#121212] border-[#27272A]',
                        'text-[#EDEDED]',
                        form.formState.errors.agentId && 'border-[#F87171]',
                      )}
                    >
                      <SelectValue placeholder="Choose an agent for this campaign" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-[#27272A]">
                      {agents?.map((agent: any) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {form.formState.errors.agentId && (
                  <p className="text-sm text-[#F87171]">
                    {form.formState.errors.agentId.message}
                  </p>
                )}
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-[#EDEDED]">
                  Start Date
                </Label>
                <Input
                  {...form.register('startDate')}
                  id="startDate"
                  type="date"
                  className={cn(
                    'bg-[#121212] border-[#27272A]',
                    'text-[#EDEDED]',
                    'focus:border-[#99CDFF] focus:ring-2 focus:ring-[#99CDFF]/20',
                  )}
                />
              </div>

              {/* Target Count */}
              <div className="space-y-2">
                <Label htmlFor="targetCount" className="text-[#EDEDED]">
                  Target Contacts
                </Label>
                <Input
                  {...form.register('targetCount', { valueAsNumber: true })}
                  id="targetCount"
                  type="number"
                  min="0"
                  placeholder="0"
                  className={cn(
                    'bg-[#121212] border-[#27272A]',
                    'text-[#EDEDED] placeholder-[#A1A1AA]',
                    'focus:border-[#99CDFF] focus:ring-2 focus:ring-[#99CDFF]/20',
                  )}
                />
                <p className="text-xs text-[#A1A1AA]">
                  Number of contacts to reach. You can add contacts later.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#27272A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={createMutation.isPending}
                  className="border-[#27272A] hover:bg-[#27272A]/50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className={cn(
                    'bg-[#99CDFF] text-[#050505]',
                    'hover:bg-[#BDDCFF]',
                    'hover:shadow-[0_0_20px_rgba(153,205,255,0.3)]',
                    'transition-all duration-200',
                  )}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 me-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 me-2" />
                      Create Campaign
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
