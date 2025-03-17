<span className="text-sm text-gray-900 dark:text-gray-200">
                                  {produto?.nome || "Produto não encontrado"}
                                </span>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  SKU: {produto?.sku || "N/A"}
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <Badge variant="outline" className="bg-blue-50 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                  Qtd: {kitProduto.quantidade}
                                </Badge>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleRemoveProdutoDoKit(kitProduto.produtoId)
                                  }
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <FaTimes className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>
          )}

          {message && (
            <Alert variant={messageType === "success" ? "success" : "destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <span>Cadastrar</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProdutoFormModal;