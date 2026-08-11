import subprocess
import os

os.chdir(r'C:/Users/fatba/Documents/kimi/workspace/frame-lab-pro-v2')

# Rename branch to main
subprocess.run(['git', 'branch', '-m', 'main'], check=True)

# Add all files
subprocess.run(['git', 'add', '.'], check=True)

# Check status
result = subprocess.run(['git', 'status', '--short'], capture_output=True, text=True)
print('STAGED FILES:')
print(result.stdout if result.stdout else '(none)')

# Commit
result = subprocess.run(['git', 'commit', '-m', 'Initial commit: Frame Lab Pro v2'], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)

# Check current remotes
result = subprocess.run(['git', 'remote', '-v'], capture_output=True, text=True)
print('REMOTES:')
print(result.stdout if result.stdout else '(none configured)')
