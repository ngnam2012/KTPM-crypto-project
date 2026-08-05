import os
import importlib
import inspect
from typing import Dict, List, Type
from src.domain.interfaces import IStrategy

class StrategyRegistry:
    """
    Registry for managing strategy plugins.
    Implements a Singleton pattern to maintain a single source of truth for available strategies.
    """
    _instance = None
    _strategies: Dict[str, Type[IStrategy]] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(StrategyRegistry, cls).__new__(cls)
            cls._instance._load_strategies()
        return cls._instance

    def _load_strategies(self):
        """Automatically discovers and loads strategy classes from the implementations directory."""
        implementations_dir = os.path.join(os.path.dirname(__file__), 'implementations')
        
        if not os.path.exists(implementations_dir):
            return

        for filename in os.listdir(implementations_dir):
            if filename.endswith(".py") and filename != "__init__.py":
                module_name = f"src.strategies.implementations.{filename[:-3]}"
                
                try:
                    module = importlib.import_module(module_name)
                    # Find all classes in the module that implement IStrategy and are not abstract
                    for name, obj in inspect.getmembers(module, inspect.isclass):
                        if issubclass(obj, IStrategy) and obj is not IStrategy and not inspect.isabstract(obj):
                            # Instantiate temporarily to get the ID, or use classmethod if preferred
                            # For simplicity, we instantiate it to register
                            try:
                                instance = obj()
                                self.register(instance.id, obj)
                            except Exception as e:
                                print(f"Error instantiating strategy {name}: {e}")
                except Exception as e:
                    print(f"Error loading module {module_name}: {e}")

    def register(self, strategy_id: str, strategy_class: Type[IStrategy]):
        """Register a new strategy class."""
        self._strategies[strategy_id] = strategy_class
        print(f"Registered strategy: {strategy_id}")

    def get_strategy(self, strategy_id: str) -> IStrategy:
        """Get an instance of a registered strategy."""
        strategy_class = self._strategies.get(strategy_id)
        if not strategy_class:
            raise ValueError(f"Strategy with id '{strategy_id}' not found.")
        return strategy_class()

    def get_all_strategies(self) -> List[Dict]:
        """Return metadata for all registered strategies."""
        result = []
        for strat_id, strat_class in self._strategies.items():
            instance = strat_class()
            result.append({
                "id": instance.id,
                "name": instance.name,
                "description": instance.description,
                "default_params": instance.default_params
            })
        return result
