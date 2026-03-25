/**
 * Knowledge Base Content Enhancement Component
 *
 * AI-powered content improvement and enhancement features
 */

import { useState } from 'react';
import { Zap, Sparkles, FileText, RefreshCw, Download, Upload, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import contentEnhancementClient from '@/lib/content-enhancement-client';

interface KBContentEnhancementProps {
  kbId: string;
  content?: string;
  onContentUpdated?: (enhancedContent: string) => void;
}

interface EnhancementTask {
  id: string;
  type: 'improve' | 'summarize' | 'expand' | 'translate' | 'format';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  input: string;
  output?: string;
  error?: string;
  config: any;
}

export function KBContentEnhancement({ kbId, content = '', onContentUpdated }: KBContentEnhancementProps) {
  const [inputContent, setInputContent] = useState(content);
  const [enhancementType, setEnhancementType] = useState<'improve' | 'summarize' | 'expand' | 'translate' | 'format'>('improve');
  const [tasks, setTasks] = useState<EnhancementTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [config, setConfig] = useState({
    language: 'auto',
    target_language: 'en',
    style: 'professional',
    length: 'medium',
    preserve_formatting: true,
    include_examples: false,
    tone: 'neutral'
  });

  const enhancementOptions = [
    {
      type: 'improve' as const,
      name: 'Enhance Content',
      description: 'Remove noise and improve formatting',
      icon: <Sparkles className="h-4 w-4" />,
      color: 'text-blue-600',
      available: true
    },
    {
      type: 'summarize' as const,
      name: 'Summarize',
      description: 'Create concise summaries of content',
      icon: <FileText className="h-4 w-4" />,
      color: 'text-green-600',
      available: false // No API endpoint available
    },
    {
      type: 'expand' as const,
      name: 'Expand',
      description: 'Add detail and comprehensive information',
      icon: <RefreshCw className="h-4 w-4" />,
      color: 'text-purple-600',
      available: false // No API endpoint available
    },
    {
      type: 'translate' as const,
      name: 'Translate',
      description: 'Translate to different languages',
      icon: <Upload className="h-4 w-4" />,
      color: 'text-orange-600',
      available: false // No API endpoint available
    },
    {
      type: 'format' as const,
      name: 'Format',
      description: 'Improve structure and formatting',
      icon: <Settings className="h-4 w-4" />,
      color: 'text-indigo-600',
      available: false // No API endpoint available
    }
  ];

  const handleEnhance = async () => {
    if (!inputContent.trim()) {
      toast({
        title: 'No Content',
        description: 'Please enter content to enhance',
        variant: 'destructive'
      });
      return;
    }

    if (enhancementType !== 'improve') {
      toast({
        title: 'Feature Coming Soon',
        description: `${enhancementOptions.find(o => o.type === enhancementType)?.name} feature is coming soon`,
        variant: 'default'
      });
      return;
    }

    setIsProcessing(true);

    const taskId = `task_${Date.now()}`;
    const newTask: EnhancementTask = {
      id: taskId,
      type: enhancementType,
      status: 'pending',
      progress: 0,
      input: inputContent,
      config: { ...config }
    };

    setTasks(prev => [newTask, ...prev]);

    try {
      // Update task to running
      setTasks(prev => prev.map(task =>
        task.id === taskId ? { ...task, status: 'running' } : task
      ));

      // Use the content enhancement API
      const result = await contentEnhancementClient.api.enhanceContent({
        content: inputContent,
        content_type: 'text/plain',
        enhancement_config: {
          mode: 'improve',
          preserve_structure: config.preserve_formatting,
          language: 'en'
        }
      });

      // Simulate progress
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setTasks(prev => prev.map(task =>
          task.id === taskId ? { ...task, progress: i } : task
        ));
      }

      // Complete task
      setTasks(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, status: 'completed', progress: 100, output: result.enhanced_content }
          : task
      ));

      // Update content if callback provided
      if (onContentUpdated) {
        onContentUpdated(result.enhanced_content);
      }

      toast({
        title: 'Enhancement Complete',
        description: 'Content has been enhanced successfully',
      });

    } catch (error: any) {
      setTasks(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, status: 'failed', error: error instanceof Error ? error.message : 'Enhancement failed' }
          : task
      ));

      toast({
        title: 'Enhancement Failed',
        description: error instanceof Error ? error.message : 'Enhancement failed',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchEnhance = async () => {
    toast({
      title: 'Batch Enhancement',
      description: 'Batch enhancement feature is coming soon',
      variant: 'default'
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Content copied to clipboard',
    });
  };

  const exportResults = () => {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const exportData = {
      timestamp: new Date().toISOString(),
      kb_id: kbId,
      tasks: completedTasks
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'content-enhancements.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Enhancement Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Content Enhancement
          </CardTitle>
          <CardDescription>
            Use AI to improve, summarize, expand, or translate your content
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Enhancement Options */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {enhancementOptions.map((option) => (
              <Card
                key={option.type}
                className={`cursor-pointer transition-all ${
                  enhancementType === option.type
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setEnhancementType(option.type)}
              >
                <CardContent className="p-4 text-center">
                  <div className={`${option.color} mb-2`}>
                    {option.icon}
                  </div>
                  <h3 className="font-medium text-sm">{option.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content Input */}
          <div className="space-y-2">
            <Label>Content to Enhance</Label>
            <Textarea
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              placeholder="Enter or paste content here..."
              rows={8}
              className="font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {inputContent.length} characters • {inputContent.trim().split(/\s+/).length} words
              </p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="batch-mode"
                  checked={batchMode}
                  onCheckedChange={(checked) => setBatchMode(!!checked)}
                />
                <Label htmlFor="batch-mode" className="text-sm">Batch mode</Label>
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Style</Label>
              <Select
                value={config.style}
                onValueChange={(value) => setConfig({ ...config, style: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Length</Label>
              <Select
                value={config.length}
                onValueChange={(value) => setConfig({ ...config, length: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Language</Label>
              <Select
                value={config.target_language}
                onValueChange={(value) => setConfig({ ...config, target_language: value })}
                disabled={enhancementType !== 'translate'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="preserve-formatting"
                    checked={config.preserve_formatting}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, preserve_formatting: !!checked })
                    }
                  />
                  <Label htmlFor="preserve-formatting" className="text-xs">
                    Preserve formatting
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-examples"
                    checked={config.include_examples}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, include_examples: !!checked })
                    }
                  />
                  <Label htmlFor="include-examples" className="text-xs">
                    Include examples
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={batchMode ? handleBatchEnhance : handleEnhance}
              disabled={isProcessing || !inputContent.trim()}
              className="min-w-[120px]"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  {batchMode ? 'Batch ' : ''}{enhancementOptions.find(o => o.type === enhancementType)?.name}
                </>
              )}
            </Button>

            {tasks.length > 0 && (
              <>
                <Dialog open={showHistory} onOpenChange={setShowHistory}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      History ({tasks.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Enhancement History</DialogTitle>
                      <DialogDescription>
                        View and manage your content enhancement results
                      </DialogDescription>
                    </DialogHeader>
                    <EnhancementHistory tasks={tasks} onCopy={copyToClipboard} />
                  </DialogContent>
                </Dialog>

                <Button variant="outline" onClick={exportResults}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Results
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Tasks */}
      {tasks.filter(task => task.status === 'running').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.filter(task => task.status === 'running').map((task) => (
                <div key={task.id} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary">{task.type}</Badge>
                      <span className="text-sm">{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EnhancementHistory({ tasks, onCopy }: { tasks: EnhancementTask[]; onCopy: (text: string) => void }) {
  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {tasks.map((task) => (
        <Card key={task.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    task.status === 'completed' ? 'default' :
                    task.status === 'failed' ? 'destructive' :
                    'secondary'
                  }
                >
                  {task.type}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>

              {task.status === 'completed' && task.output && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(task.output!)}
                >
                  Copy Result
                </Button>
              )}
            </div>

            {task.status === 'completed' && task.output && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">
                  {task.output.length > 300 ? task.output.substring(0, 300) + '...' : task.output}
                </pre>
              </div>
            )}

            {task.status === 'failed' && task.error && (
              <Alert variant="destructive">
                <AlertDescription>{task.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}