import React, { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { getChallengeImbalance, fulfillTreasuryMatches } from '@/lib/adminApi';
import { useQuery } from '@tanstack/react-query';

interface TreasuryImbalanceMonitorProps {
  challengeId: number;
  onRefresh?: () => void;
}

export const TreasuryImbalanceMonitor: React.FC<TreasuryImbalanceMonitorProps> = ({
  challengeId,
  onRefresh,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchToFill, setMatchToFill] = useState<number>(0);
  const [selectedSide, setSelectedSide] = useState<'YES' | 'NO' | null>(null);

  // Query for imbalance data
  const { data: imbalance, isLoading: isLoadingImbalance, refetch } = useQuery({
    queryKey: [`challenge-imbalance-${challengeId}`],
    queryFn: () => getChallengeImbalance(challengeId),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  if (isLoadingImbalance) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  if (!imbalance) {
    return null;
  }

  const { yesStakes, noStakes, yesCount, noCount, gap, imbalancedSide, matchRate, treasuryConfig } = imbalance;
  const hasImbalance = gap > 0;

  const handleFulfillMatches = async () => {
    if (!selectedSide || matchToFill <= 0) {
      setError('Please select a side and number of matches');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fulfillTreasuryMatches(challengeId, matchToFill, selectedSide);
      
      if (result.success) {
        setSelectedSide(null);
        setMatchToFill(0);
        refetch();
        onRefresh?.();
      } else {
        setError(result.message || 'Failed to fulfill Treasury matches');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full border-2">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Treasury Imbalance Monitor</CardTitle>
            <CardDescription>Real-time matching status for this challenge</CardDescription>
          </div>
          {hasImbalance && (
            <Badge variant="destructive" className="text-sm">
              IMBALANCED
            </Badge>
          )}
          {!hasImbalance && (
            <Badge variant="default" className="text-sm bg-green-600">
              BALANCED
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Imbalance Meter */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Participant Distribution</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">YES Votes</span>
                <Badge variant="outline" className="bg-green-50">
                  {yesCount} users
                </Badge>
              </div>
              <p className="text-2xl font-bold text-green-600">₦{yesStakes.toLocaleString()}</p>
              <Progress value={yesCount > 0 ? Math.min(100, (yesCount / (yesCount + noCount)) * 100) : 0} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">NO Votes</span>
                <Badge variant="outline" className="bg-red-50">
                  {noCount} users
                </Badge>
              </div>
              <p className="text-2xl font-bold text-red-600">₦{noStakes.toLocaleString()}</p>
              <Progress value={noCount > 0 ? Math.min(100, (noCount / (yesCount + noCount)) * 100) : 0} className="h-2" />
            </div>
          </div>
        </div>

        {/* Match Rate */}
        <div className="space-y-2 bg-slate-50 p-4 rounded-lg border">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Current Match Rate</span>
            <span className="text-lg font-bold text-blue-600">{matchRate}%</span>
          </div>
          <Progress value={matchRate} className="h-2" />
          <p className="text-xs text-slate-600">
            {Math.min(yesCount, noCount)} out of {yesCount + noCount} users matched
          </p>
        </div>

        {/* Imbalance Gap */}
        {hasImbalance && (
          <Alert variant="default" className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Gap: ₦{gap.toLocaleString()}</strong> on the{' '}
              <strong>{imbalancedSide}</strong> side
              <br />
              <span className="text-sm">
                {imbalancedSide === 'YES' ? yesCount : noCount} unmatched users waiting
              </span>
            </AlertDescription>
          </Alert>
        )}

        {!hasImbalance && (
          <Alert variant="default" className="border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">
              ✓ Challenge is perfectly balanced. No Treasury intervention needed.
            </AlertDescription>
          </Alert>
        )}

        {/* Treasury Config Status */}
        {treasuryConfig && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm text-blue-900">Treasury Configuration</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700">Max Risk</p>
                <p className="font-semibold">₦{treasuryConfig.maxTreasuryRisk.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-blue-700">Allocated</p>
                <p className="font-semibold">₦{treasuryConfig.totalTreasuryAllocated.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-blue-700">Remaining</p>
                <p className="font-semibold">₦{(treasuryConfig.maxTreasuryRisk - treasuryConfig.totalTreasuryAllocated).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-blue-700">Matches Filled</p>
                <p className="font-semibold">{treasuryConfig.filledCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* Fulfillment Action */}
        {hasImbalance && treasuryConfig && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="font-semibold text-sm">Fill with Treasury</h4>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min="1"
                value={matchToFill}
                onChange={(e) => setMatchToFill(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="Count"
                className="col-span-1 px-3 py-2 border rounded-md text-sm"
                disabled={isLoading}
              />
              <select
                value={selectedSide || ''}
                onChange={(e) => setSelectedSide(e.target.value as 'YES' | 'NO' | null)}
                className="col-span-1 px-3 py-2 border rounded-md text-sm"
                disabled={isLoading}
              >
                <option value="">Select Side</option>
                <option value="YES">YES Side</option>
                <option value="NO">NO Side</option>
              </select>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={!selectedSide || matchToFill <= 0 || isLoading}
                    className="col-span-1"
                  >
                    {isLoading ? <Spinner className="h-4 w-4" /> : 'Confirm'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Treasury Match Fulfillment</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription>
                    <div className="space-y-3 text-sm text-slate-700">
                      <p>You are about to fill <strong>{matchToFill} matches</strong> on the <strong>{selectedSide}</strong> side with Treasury funds.</p>
                      <div className="bg-slate-50 p-3 rounded border">
                        <p><span className="font-medium">Matches to create:</span> {matchToFill}</p>
                        <p><span className="font-medium">Side:</span> {selectedSide}</p>
                        <p><span className="font-medium">Treasury to deploy:</span> ≈ ₦{(matchToFill * 100).toLocaleString()} (est.)</p>
                      </div>
                      <p className="text-orange-600">⚠️ This action cannot be undone. Ensure you have sufficient Treasury balance.</p>
                    </div>
                  </AlertDialogDescription>
                  <div className="flex gap-3 pt-4">
                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleFulfillMatches}
                      disabled={isLoading}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isLoading ? 'Processing...' : 'Confirm & Fill'}
                    </AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {!treasuryConfig && hasImbalance && (
          <Alert variant="default" className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-blue-800">
              Set a Treasury configuration first to enable automatic matching.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default TreasuryImbalanceMonitor;
