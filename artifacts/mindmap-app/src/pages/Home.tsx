import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useMindmaps } from '@/hooks/use-mindmaps';
import { Plus, Map as MapIcon, Trash2, Clock, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function Home() {
  const { maps, loading, create, remove, rename, syncStatus } = useMindmaps();
  const [, setLocation] = useLocation();
  const [newTitle, setNewTitle] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMapId, setEditingMapId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const id = await create(newTitle.trim());
    setIsCreateOpen(false);
    setNewTitle('');
    setLocation(`/map/${id}`);
  };

  const handleRename = async () => {
    if (!editingMapId || !newTitle.trim()) return;
    await rename(editingMapId, newTitle.trim());
    setEditingMapId(null);
    setNewTitle('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <MapIcon className="w-4 h-4 text-primary" />
              </div>
              Карта жизни
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Ваше личное пространство для идей и планов
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Sync status indicator */}
            <div className="flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-secondary/50 border border-border">
              <span className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced' ? 'bg-green-500' :
                syncStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' :
                'bg-muted-foreground'
              }`} />
              <span className="text-muted-foreground capitalize">
                {syncStatus === 'synced' ? 'Синхронизировано' :
                 syncStatus === 'syncing' ? 'Синхронизация...' : 'Офлайн'}
              </span>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full pl-3 pr-4 shadow-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Новая карта
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Создать новую карту</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    placeholder="Название (например: План на год)"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Отмена</Button>
                  <Button onClick={handleCreate}>Создать</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {maps.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
              <MapIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">У вас пока нет карт</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Нажмите «Новая карта», чтобы создать своё первое пространство для мыслей.
            </p>
            <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
              Создать карту
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {maps.map(map => (
              <Card 
                key={map.id} 
                className="group relative overflow-hidden transition-all hover:border-primary/50 cursor-pointer active:scale-[0.98]"
                onClick={() => setLocation(`/map/${map.id}`)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg leading-tight truncate pr-8">
                    {map.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Обновлено {formatDistanceToNow(new Date(map.updatedAt), { addSuffix: true, locale: ru })}
                  </div>
                </CardContent>
                
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Dialog open={editingMapId === map.id} onOpenChange={(open) => {
                    if (open) {
                      setNewTitle(map.title);
                      setEditingMapId(map.id);
                    } else {
                      setEditingMapId(null);
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm"
                        onClick={e => e.stopPropagation()}
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent onClick={e => e.stopPropagation()}>
                      <DialogHeader>
                        <DialogTitle>Переименовать карту</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <Input
                          value={newTitle}
                          onChange={e => setNewTitle(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleRename()}
                          autoFocus
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditingMapId(null)}>Отмена</Button>
                        <Button onClick={handleRename}>Сохранить</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Точно удалить эту карту? Это действие нельзя отменить.')) {
                        remove(map.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
